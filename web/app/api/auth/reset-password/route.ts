import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { transaction, queryOne } from "@/lib/server-db";
import { getSession, createSession } from "@/lib/session";
import { resetPasswordSchema } from "@/lib/validations";

interface UserRow {
  id: string;
  email: string;
  "encryptionSalt": string;
  status: "pending_email" | "pending_recovery" | "active";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { newPassword, contacts } = parsed.data;

    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await transaction(async (client) => {
      const userResult = await client.query<UserRow>(
        'SELECT id, email, "encryptionSalt", status FROM "User" WHERE id = $1',
        [session.id]
      );
      const user = userResult.rows[0];
      if (!user || user.status !== "active") {
        const error = new Error("User not found");
        (error as Error & { statusCode?: number }).statusCode = 404;
        throw error;
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await client.query(
        `UPDATE "User"
         SET "passwordHash" = $1,
             "passwordResetCodeHash" = NULL,
             "passwordResetCodeExpiresAt" = NULL,
             "updatedAt" = NOW()
         WHERE id = $2`,
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

    // Re-create session to be safe.
    const user = await queryOne<UserRow>(
      'SELECT id, email, "encryptionSalt", status FROM "User" WHERE id = $1',
      [session.id]
    );
    if (!user) {
      throw new Error("User not found");
    }
    await createSession({
      id: user.id,
      email: user.email,
      encryptionSalt: user.encryptionSalt,
      status: user.status,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        encryptionSalt: user.encryptionSalt,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Reset password error:", error);

    const statusCode =
      error instanceof Error ? (error as Error & { statusCode?: number }).statusCode : undefined;
    const message = error instanceof Error ? error.message : "Failed to reset password";

    return NextResponse.json(
      { error: message },
      { status: statusCode ?? 500 }
    );
  }
}
