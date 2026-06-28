import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/server-db";
import { sendPasswordResetEmail } from "@/lib/email";
import { generateAuthCode, getAuthCodeExpiresAt, hashAuthCode } from "@/lib/auth-codes";
import { requestPasswordResetSchema } from "@/lib/validations";

interface UserRow {
  id: string;
  email: string;
  status: "pending_email" | "pending_recovery" | "active";
  "recoveryKeyHash": string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestPasswordResetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const user = await queryOne<UserRow>(
      `SELECT id, email, status, "recoveryKeyHash"
       FROM "User"
       WHERE email = $1`,
      [parsed.data.email]
    );

    if (user?.status === "active" && user.recoveryKeyHash) {
      const passwordResetCode = generateAuthCode();
      const passwordResetCodeHash = await hashAuthCode(passwordResetCode);
      const passwordResetExpiresAt = getAuthCodeExpiresAt();

      // Always return success later so reset requests cannot enumerate accounts.
      await queryOne<UserRow>(
        `UPDATE "User"
         SET "passwordResetCodeHash" = $1,
             "passwordResetCodeExpiresAt" = $2,
             "updatedAt" = NOW()
         WHERE id = $3
         RETURNING id, email, status, "recoveryKeyHash"`,
        [passwordResetCodeHash, passwordResetExpiresAt, user.id]
      );

      try {
        await sendPasswordResetEmail(user.email, passwordResetCode);
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Password reset request error:", error);
    return NextResponse.json(
      { error: "Failed to request password reset" },
      { status: 500 }
    );
  }
}
