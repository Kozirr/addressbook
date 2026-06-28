import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/server-db";
import { getSession, destroySession } from "@/lib/session";
import { deleteAccountSchema } from "@/lib/validations";

interface UserRow {
  id: string;
  "passwordHash": string;
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = deleteAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { currentPassword } = parsed.data;

    const user = await queryOne<UserRow>(
      'SELECT id, "passwordHash" FROM "User" WHERE id = $1',
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

    await queryOne<{ id: string }>(
      'DELETE FROM "User" WHERE id = $1 RETURNING id',
      [session.id]
    );

    await destroySession();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
