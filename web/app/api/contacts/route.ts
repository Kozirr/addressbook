import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/server-db";
import { jsonError, parseJsonBody, requireSession } from "@/lib/api";
import { encryptedContactBodySchema } from "@/lib/validations";

interface ContactRow {
  id: string;
  encryptedData: string;
  iv: string;
  serverUpdatedAt: string;
  version: number;
}

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const cursor = searchParams.get("cursor");

  const contacts = await query<ContactRow>(
    cursor
      ? `SELECT id, "encryptedData", iv, "serverUpdatedAt", version
         FROM "EncryptedContact"
         WHERE "userId" = $1 AND "serverUpdatedAt" > (
           SELECT "serverUpdatedAt"
           FROM "EncryptedContact"
           WHERE id = $2 AND "userId" = $1
         )
         ORDER BY "serverUpdatedAt" ASC, id ASC
         LIMIT $3`
      : `SELECT id, "encryptedData", iv, "serverUpdatedAt", version
         FROM "EncryptedContact"
         WHERE "userId" = $1
         ORDER BY "serverUpdatedAt" ASC, id ASC
         LIMIT $2`,
    cursor ? [auth.session.id, cursor, limit] : [auth.session.id, limit]
  );

  return NextResponse.json({ contacts });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const parsed = await parseJsonBody(request, encryptedContactBodySchema);
    if ("response" in parsed) return parsed.response;
    const { id, encryptedData, iv, serverUpdatedAt } = parsed.data;

    const contact = await query<ContactRow>(
      `INSERT INTO "EncryptedContact" (id, "userId", "encryptedData", iv, "serverUpdatedAt")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, "encryptedData", iv, "serverUpdatedAt", version`,
      [id, auth.session.id, encryptedData, iv, serverUpdatedAt ? new Date(serverUpdatedAt) : new Date()]
    );

    return NextResponse.json({ contact: contact[0] });
  } catch (error) {
    console.error("Create contact error:", error);
    return jsonError("Failed to create contact");
  }
}
