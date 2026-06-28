import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/server-db";
import { getSession, createSession } from "@/lib/session";
import { updateEmailSchema } from "@/lib/validations";

interface UserRow {
  id: string;
  email: string;
  "passwordHash": string;
  "encryptionSalt": string;
  status: "pending_email" | "pending_recovery" | "active";
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, currentPassword } = parsed.data;

    const user = await queryOne<UserRow>(
      'SELECT id, email, "passwordHash", "encryptionSalt" FROM "User" WHERE id = $1',
      [session.id]
    );
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM "User" WHERE email = $1 AND id != $2',
      [email, session.id]
    );
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const updated = await queryOne<UserRow>(
      'UPDATE "User" SET email = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING id, email, "encryptionSalt", status',
      [email, session.id]
    );
    if (!updated) {
      throw new Error("Failed to update email");
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
    });
  } catch (error) {
    console.error("Update email error:", error);
    return NextResponse.json(
      { error: "Failed to update email" },
      { status: 500 }
    );
  }
}
