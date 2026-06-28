import { NextResponse } from "next/server";
import { queryOne } from "@/lib/server-db";
import { getSession } from "@/lib/session";

interface UserRow {
  id: string;
  email: string;
  "encryptionSalt": string;
  "recoverySalt": string;
  status: "pending_email" | "pending_recovery" | "active";
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = await queryOne<UserRow>(
    'SELECT id, email, "encryptionSalt", "recoverySalt", status FROM "User" WHERE id = $1',
    [session.id]
  );

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      encryptionSalt: user.encryptionSalt,
      recoverySalt: user.recoverySalt,
      status: user.status,
    },
  });
}
