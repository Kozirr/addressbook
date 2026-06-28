import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/server-db";
import { createSession, getSession } from "@/lib/session";
import { verifyAuthCode } from "@/lib/auth-codes";
import { confirmEmailSchema } from "@/lib/validations";

interface UserRow {
  id: string;
  email: string;
  "encryptionSalt": string;
  "emailConfirmationCodeHash": string | null;
  status: "pending_email" | "pending_recovery" | "active";
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/confirm-email", request.url));
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = confirmEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const user = await queryOne<UserRow>(
      `SELECT id, email, "encryptionSalt", "emailConfirmationCodeHash", status
       FROM "User"
       WHERE id = $1
         AND "emailConfirmationCodeExpiresAt" > NOW()`,
      [session.id]
    );

    if (!user || user.status !== "pending_email" || !user.emailConfirmationCodeHash) {
      return NextResponse.json(
        { error: "Invalid or expired confirmation code" },
        { status: 400 }
      );
    }

    const valid = await verifyAuthCode(parsed.data.code, user.emailConfirmationCodeHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid or expired confirmation code" },
        { status: 400 }
      );
    }

    const updated = await queryOne<UserRow>(
      `UPDATE "User"
       SET status = 'pending_recovery',
           "emailConfirmedAt" = NOW(),
           "emailConfirmationCodeHash" = NULL,
           "emailConfirmationCodeExpiresAt" = NULL,
           "confirmationToken" = NULL,
           "confirmationTokenExpiresAt" = NULL,
           "updatedAt" = NOW()
       WHERE id = $1
       RETURNING id, email, "encryptionSalt", status`,
      [user.id]
    );

    if (!updated) {
      throw new Error("Failed to confirm email");
    }

    await createSession({
      id: updated.id,
      email: updated.email,
      encryptionSalt: updated.encryptionSalt,
      status: updated.status,
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email,
        encryptionSalt: updated.encryptionSalt,
        status: updated.status,
      },
      redirectTo: "/recovery-setup",
    });
  } catch (error) {
    console.error("Confirm email error:", error);
    return NextResponse.json(
      { error: "Failed to confirm email" },
      { status: 500 }
    );
  }
}
