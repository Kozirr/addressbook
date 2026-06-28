import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { transaction } from "@/lib/server-db";
import { getSession } from "@/lib/session";
import { updatePasswordSchema } from "@/lib/validations";

interface UserRow {
  id: string;
  "passwordHash": string;
}

const changePasswordBodySchema = updatePasswordSchema.extend({
  contacts: z.array(
    z.object({
      id: z.string(),
      encryptedData: z.string(),
      iv: z.string(),
      serverUpdatedAt: z.string(),
    })
  ).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = changePasswordBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword, contacts = [] } = parsed.data;

    await transaction(async (client) => {
      const userResult = await client.query<UserRow>(
        'SELECT id, "passwordHash" FROM "User" WHERE id = $1',
        [session.id]
      );
      const user = userResult.rows[0];
      if (!user) {
        throw new Error("User not found");
      }

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        const error = new Error("Current password is incorrect");
        (error as Error & { statusCode?: number }).statusCode = 401;
        throw error;
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await client.query(
        'UPDATE "User" SET "passwordHash" = $1, "updatedAt" = NOW() WHERE id = $2',
        [passwordHash, session.id]
      );

      for (const contact of contacts) {
        await client.query(
          `UPDATE "EncryptedContact"
           SET "encryptedData" = $1,
               iv = $2,
               "serverUpdatedAt" = $3,
               version = version + 1
           WHERE id = $4 AND "userId" = $5`,
          [contact.encryptedData, contact.iv, new Date(contact.serverUpdatedAt), contact.id, session.id]
        );
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update password error:", error);

    const statusCode =
      error instanceof Error ? (error as Error & { statusCode?: number }).statusCode : undefined;
    const message = error instanceof Error ? error.message : "Failed to update password";

    return NextResponse.json(
      { error: message },
      { status: statusCode ?? 500 }
    );
  }
}
