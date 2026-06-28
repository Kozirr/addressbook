import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { jsonError, parseJsonBody } from "@/lib/api";
import { queryOne } from "@/lib/server-db";
import { generateEncryptionSalt } from "@/lib/crypto";
import { registerSchema } from "@/lib/validations";
import { sendConfirmationEmail } from "@/lib/email";
import { createSession } from "@/lib/session";
import { generateAuthCode, getAuthCodeExpiresAt, hashAuthCode } from "@/lib/auth-codes";

interface UserRow {
  id: string;
  email: string;
  "encryptionSalt": string;
  "recoverySalt": string;
  status: "pending_email" | "pending_recovery" | "active";
}

function publicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    encryptionSalt: user.encryptionSalt,
    recoverySalt: user.recoverySalt,
    status: user.status,
  };
}

async function emailIsTaken(email: string) {
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM "User" WHERE email = $1',
    [email]
  );
  return Boolean(existing);
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request, registerSchema);
    if ("response" in parsed) return parsed.response;

    const { email, password } = parsed.data;

    if (await emailIsTaken(email)) {
      return jsonError("An account with this email already exists", 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const encryptionSalt = generateEncryptionSalt();
    const recoverySalt = generateEncryptionSalt();
    const confirmationCode = generateAuthCode();
    const confirmationCodeHash = await hashAuthCode(confirmationCode);
    const confirmationCodeExpiresAt = getAuthCodeExpiresAt();

    const user = await queryOne<UserRow>(
      `INSERT INTO "User" (
         email, "passwordHash", "encryptionSalt", "recoverySalt",
         status, "emailConfirmationCodeHash", "emailConfirmationCodeExpiresAt"
       )
       VALUES ($1, $2, $3, $4, 'pending_email', $5, $6)
       RETURNING id, email, "encryptionSalt", "recoverySalt", status`,
      [email, passwordHash, encryptionSalt, recoverySalt, confirmationCodeHash, confirmationCodeExpiresAt]
    );

    if (!user) {
      throw new Error("Failed to create user");
    }

    try {
      await sendConfirmationEmail(email, confirmationCode);
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
      // Continue; user can request a resend later or check logs in dev.
    }

    await createSession({
      id: user.id,
      email: user.email,
      encryptionSalt: user.encryptionSalt,
      status: user.status,
    });

    return NextResponse.json({
      user: publicUser(user),
      redirectTo: "/confirm-email",
    });
  } catch (error) {
    console.error("Register error:", error);
    return jsonError("Failed to create account");
  }
}
