import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/server-db";
import { createSession, getSession } from "@/lib/session";
import { completeRecoverySchema } from "@/lib/validations";

interface UserRow {
  id: string;
  email: string;
  "encryptionSalt": string;
  status: "pending_email" | "pending_recovery" | "active";
}

const PENDING_RECOVERY_REQUIRED = "Recovery setup is not pending for this account";

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = completeRecoverySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const {
      recoveryKeyHash,
      recoveryKeyIdentifier,
      wrappedMasterKeyRecovery,
    } = parsed.data;

    const user = await queryOne<UserRow>(
      'SELECT id, email, "encryptionSalt", status FROM "User" WHERE id = $1',
      [session.id]
    );
    if (!user || user.status !== "pending_recovery") {
      return NextResponse.json(
        { error: PENDING_RECOVERY_REQUIRED },
        { status: 400 }
      );
    }

    // Activation is delayed until the browser stores a recovery-wrapped master key.
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
      throw new Error("Failed to persist recovery setup");
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
    console.error("Complete recovery error:", error);
    return NextResponse.json(
      { error: "Failed to complete recovery setup" },
      { status: 500 }
    );
  }
}
