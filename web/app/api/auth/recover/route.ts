import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/server-db";
import { getSession, createSession } from "@/lib/session";
import { verifyRecoveryKey, getRecoveryKeyIdentifier } from "@/lib/recovery";
import { recoverAccountSchema } from "@/lib/validations";
import { verifyAuthCode } from "@/lib/auth-codes";

interface UserRow {
  id: string;
  email: string;
  "encryptionSalt": string;
  "recoverySalt": string;
  "recoveryKeyHash": string;
  "passwordResetCodeHash": string | null;
  "wrappedMasterKeyRecovery": string;
  status: "pending_email" | "pending_recovery" | "active";
}

interface ContactRow {
  id: string;
  "encryptedData": string;
  iv: string;
  "serverUpdatedAt": string;
}

const INVALID_RECOVERY_CHALLENGE = "Invalid reset code or recovery key";

export async function POST(request: NextRequest) {
  try {
    // If already authenticated, return current user's recovery state.
    const existingSession = await getSession();
    if (existingSession) {
      return NextResponse.json(
        { error: "Already authenticated" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = recoverAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, resetCode, recoveryKey } = parsed.data;

    const identifier = await getRecoveryKeyIdentifier(recoveryKey);

    // Match by recovery-key identifier before verifying the full key hash.
    const user = await queryOne<UserRow>(
      `SELECT id, email, "encryptionSalt", "recoverySalt", "recoveryKeyHash",
              "passwordResetCodeHash", "wrappedMasterKeyRecovery", status
       FROM "User"
       WHERE "recoveryKeyIdentifier" = $1
         AND email = $2
         AND "passwordResetCodeExpiresAt" > NOW()
         AND status = 'active'`,
      [identifier, email]
    );

    if (!user || !user.passwordResetCodeHash) {
      return NextResponse.json(
        { error: INVALID_RECOVERY_CHALLENGE },
        { status: 401 }
      );
    }

    const resetCodeMatches = await verifyAuthCode(resetCode, user.passwordResetCodeHash);
    if (!resetCodeMatches) {
      return NextResponse.json(
        { error: INVALID_RECOVERY_CHALLENGE },
        { status: 401 }
      );
    }

    const recoveryKeyMatches = await verifyRecoveryKey(recoveryKey, user.recoveryKeyHash);
    if (!recoveryKeyMatches) {
      return NextResponse.json(
        { error: INVALID_RECOVERY_CHALLENGE },
        { status: 401 }
      );
    }

    const contacts = await query<ContactRow>(
      `SELECT id, "encryptedData", iv, "serverUpdatedAt"
       FROM "EncryptedContact"
       WHERE "userId" = $1
       ORDER BY "serverUpdatedAt" ASC, id ASC`,
      [user.id]
    );

    await createSession({
      id: user.id,
      email: user.email,
      encryptionSalt: user.encryptionSalt,
      status: user.status,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        encryptionSalt: user.encryptionSalt,
        recoverySalt: user.recoverySalt,
      },
      wrappedMasterKeyRecovery: JSON.parse(user.wrappedMasterKeyRecovery),
      contacts,
    });
  } catch (error) {
    console.error("Recover error:", error);
    return NextResponse.json(
      { error: "Failed to recover account" },
      { status: 500 }
    );
  }
}
