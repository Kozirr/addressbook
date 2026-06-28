import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/server-db";

interface UserRow {
  id: string;
  email: string;
  "encryptionSalt": string;
  "recoverySalt": string;
  status: "pending_email" | "pending_recovery" | "active";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const user = await queryOne<UserRow>(
      `SELECT id, email, "encryptionSalt", "recoverySalt", status
       FROM "User"
       WHERE email = $1`,
      [email]
    );

    if (!user || user.status !== "pending_recovery") {
      return NextResponse.json(
        { error: "Invalid or expired setup state" },
        { status: 400 }
      );
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
  } catch (error) {
    console.error("Setup state error:", error);
    return NextResponse.json(
      { error: "Failed to fetch setup state" },
      { status: 500 }
    );
  }
}
