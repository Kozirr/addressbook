import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/server-db";
import { createSession } from "@/lib/session";
import { confirmRecoverySchema } from "@/lib/validations";

interface UserRow {
  id: string;
  email: string;
  "passwordHash": string;
  "encryptionSalt": string;
  status: "pending_email" | "pending_recovery" | "active";
}

const PENDING_RECOVERY_REQUIRED = "Recovery setup is not pending for this account";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = confirmRecoverySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const {
      email,
      password,
      recoveryKeyHash,
      recoveryKeyIdentifier,
      wrappedMasterKeyRecovery,
    } = parsed.data;

    const user = await queryOne<UserRow>(
      'SELECT id, email, "passwordHash", "encryptionSalt", status FROM "User" WHERE email = $1',
      [email]
    );
    if (!user || user.status !== "pending_recovery") {
      return NextResponse.json(
        { error: PENDING_RECOVERY_REQUIRED },
        { status: 400 }
      );
    }

    const passwordMatchesAccount = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatchesAccount) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    // Confirmation binds the recovery key to the account before first active login.
    const activatedUser = await queryOne<UserRow>(
      `UPDATE "User"
       SET "recoveryKeyHash" = $1,
           "recoveryKeyIdentifier" = $2,
           "wrappedMasterKeyRecovery" = $3,
           "recoveryConfirmedAt" = NOW(),
           status = 'active',
           "updatedAt" = NOW()
       WHERE id = $4
       RETURNING id, email, "encryptionSalt", status`,
      [
        recoveryKeyHash,
        recoveryKeyIdentifier,
        JSON.stringify(wrappedMasterKeyRecovery),
        user.id,
      ]
    );

    if (!activatedUser) {
      throw new Error("Failed to persist recovery confirmation");
    }

    await createSession({
      id: activatedUser.id,
      email: activatedUser.email,
      encryptionSalt: activatedUser.encryptionSalt,
      status: activatedUser.status,
    });

    return NextResponse.json({
      user: {
        id: activatedUser.id,
        email: activatedUser.email,
        encryptionSalt: activatedUser.encryptionSalt,
        status: activatedUser.status,
      },
    });
  } catch (error) {
    console.error("Confirm recovery error:", error);
    return NextResponse.json(
      { error: "Failed to confirm recovery key" },
      { status: 500 }
    );
  }
}
