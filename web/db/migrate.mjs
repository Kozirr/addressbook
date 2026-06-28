import { Pool } from "pg";
import fs from "fs/promises";
import path from "path";

async function loadEnvFile() {
  try {
    const env = await fs.readFile(path.join(process.cwd(), ".env"), "utf-8");
    for (const line of env.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

      const [key, ...valueParts] = trimmed.split("=");
      if (process.env[key]) continue;

      const rawValue = valueParts.join("=").trim();
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await loadEnvFile();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "__migrations" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT UNIQUE NOT NULL,
      "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query('SELECT name FROM "__migrations"');
  return new Set(result.rows.map((row) => row.name));
}

async function getMigrationFiles() {
  const migrationsDir = path.join(process.cwd(), "db", "migrations");
  const files = await fs.readdir(migrationsDir);
  return files.filter((file) => file.endsWith(".sql")).sort();
}

async function runMigration(client, fileName, sql) {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query('INSERT INTO "__migrations" (name) VALUES ($1)', [
      fileName,
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const files = await getMigrationFiles();

    let appliedCount = 0;
    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = await fs.readFile(
        path.join(process.cwd(), "db", "migrations", file),
        "utf-8"
      );
      console.log(`Applying migration: ${file}`);
      await runMigration(client, file, sql);
      appliedCount++;
    }

    if (appliedCount === 0) {
      console.log("No pending migrations");
    } else {
      console.log(`Applied ${appliedCount} migration(s)`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
