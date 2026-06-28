import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/server-db";
import { jsonError, parseJsonBody, requireSession } from "@/lib/api";
import { encryptedContactUpdateSchema } from "@/lib/validations";

interface ContactRow {
  id: string;
  encryptedData: string;
  iv: string;
  serverUpdatedAt: string;
  version: number;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const parsed = await parseJsonBody(request, encryptedContactUpdateSchema);
    if ("response" in parsed) return parsed.response;
    const { encryptedData, iv, serverUpdatedAt } = parsed.data;

    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM "EncryptedContact" WHERE id = $1 AND "userId" = $2',
      [id, auth.session.id]
    );
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const contact = await query<ContactRow>(
      `UPDATE "EncryptedContact"
       SET "encryptedData" = $1,
           iv = $2,
           "serverUpdatedAt" = $3,
           version = version + 1
       WHERE id = $4 AND "userId" = $5
       RETURNING id, "encryptedData", iv, "serverUpdatedAt", version`,
      [
        encryptedData,
        iv,
        serverUpdatedAt ? new Date(serverUpdatedAt) : new Date(),
        id,
        auth.session.id,
      ]
    );

    return NextResponse.json({ contact: contact[0] });
  } catch (error) {
    console.error("Update contact error:", error);
    return jsonError("Failed to update contact");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM "EncryptedContact" WHERE id = $1 AND "userId" = $2',
      [id, auth.session.id]
    );
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await query('DELETE FROM "EncryptedContact" WHERE id = $1 AND "userId" = $2', [
      id,
      auth.session.id,
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete contact error:", error);
    return jsonError("Failed to delete contact");
  }
}
