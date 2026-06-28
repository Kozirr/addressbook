import { NextRequest, NextResponse } from "next/server";
import { transaction } from "@/lib/server-db";
import { jsonError, parseJsonBody, requireSession } from "@/lib/api";
import { contactSyncSchema } from "@/lib/validations";

interface EncryptedContactRow {
  id: string;
  encryptedData: string;
  iv: string;
  serverUpdatedAt: string;
  version: number;
}

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const parsed = await parseJsonBody(request, contactSyncSchema);
    if ("response" in parsed) return parsed.response;
    const { changes } = parsed.data;

    const results: Array<{ id: string; status: "ok" | "conflict" }> = [];

    await transaction(async (client) => {
      for (const change of changes) {
        const existingRecord = await client.query<EncryptedContactRow>(
          'SELECT * FROM "EncryptedContact" WHERE id = $1 AND "userId" = $2',
          [change.id, auth.session.id]
        );

        if (change.type === "delete") {
          if (existingRecord.rows.length > 0) {
            await client.query(
              'DELETE FROM "EncryptedContact" WHERE id = $1 AND "userId" = $2',
              [change.id, auth.session.id]
            );
          }
          results.push({ id: change.id, status: "ok" });
          continue;
        }

        if (existingRecord.rows.length > 0) {
          const incomingServerUpdatedAt = change.serverUpdatedAt
            ? new Date(change.serverUpdatedAt)
            : new Date();
          // The server only compares encrypted record timestamps; contact fields stay opaque.
          if (incomingServerUpdatedAt >= new Date(existingRecord.rows[0].serverUpdatedAt)) {
            await client.query(
              `UPDATE "EncryptedContact"
               SET "encryptedData" = $1,
                   iv = $2,
                   "serverUpdatedAt" = $3,
                   version = version + 1
               WHERE id = $4 AND "userId" = $5`,
              [
                change.encryptedData,
                change.iv,
                incomingServerUpdatedAt,
                change.id,
                auth.session.id,
              ]
            );
            results.push({ id: change.id, status: "ok" });
          } else {
            results.push({ id: change.id, status: "conflict" });
          }
        } else {
          await client.query(
            `INSERT INTO "EncryptedContact" (id, "userId", "encryptedData", iv, "serverUpdatedAt")
             VALUES ($1, $2, $3, $4, $5)`,
            [
              change.id,
              auth.session.id,
              change.encryptedData,
              change.iv,
              change.serverUpdatedAt ? new Date(change.serverUpdatedAt) : new Date(),
            ]
          );
          results.push({ id: change.id, status: "ok" });
        }
      }
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Sync error:", error);
    return jsonError("Failed to apply encrypted contact sync");
  }
}
