import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/server-db";
import { getSession } from "@/lib/session";
import { completeRecoverySchema } from "@/lib/validations";

interface UserRow {
  id: string;
  email: string;
  status: "pending_email" | "pending_recovery" | "active";
}

const ACTIVE_ACCOUNT_REQUIRED = "Recovery key can only be reset for an active account";

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
      'SELECT id, email, status FROM "User" WHERE id = $1',
      [session.id]
    );
    if (!user || user.status !== "active") {
      return NextResponse.json(
        { error: ACTIVE_ACCOUNT_REQUIRED },
        { status: 400 }
      );
    }

    // Recovery-key rotation keeps the same master key and replaces only its recovery wrapping.
    await queryOne<UserRow>(
      `UPDATE "User"
       SET "recoveryKeyHash" = $1,
           "recoveryKeyIdentifier" = $2,
           "wrappedMasterKeyRecovery" = $3,
           "recoveryConfirmedAt" = NOW(),
           "updatedAt" = NOW()
       WHERE id = $4
       RETURNING id, email, status`,
      [
        recoveryKeyHash,
        recoveryKeyIdentifier,
        JSON.stringify(wrappedMasterKeyRecovery),
        user.id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset recovery key error:", error);
    return NextResponse.json(
      { error: "Failed to reset recovery key" },
      { status: 500 }
    );
  }
}
