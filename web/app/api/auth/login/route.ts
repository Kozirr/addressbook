import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { jsonError, parseJsonBody } from "@/lib/api";
import { queryOne } from "@/lib/server-db";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validations";

interface UserRow {
  id: string;
  email: string;
  "passwordHash": string;
  "encryptionSalt": string;
  status: "pending_email" | "pending_recovery" | "active";
}

const BAD_CREDENTIALS = "Invalid email or password";

function redirectAfterLogin(status: UserRow["status"]) {
  switch (status) {
    case "pending_email":
      return "/confirm-email";
    case "pending_recovery":
      return "/recovery-setup";
    case "active":
      return "/";
  }
}

function publicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    encryptionSalt: user.encryptionSalt,
    status: user.status,
  };
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request, loginSchema);
    if ("response" in parsed) return parsed.response;

    const { email, password } = parsed.data;

    const user = await queryOne<UserRow>(
      'SELECT id, email, "passwordHash", "encryptionSalt", status FROM "User" WHERE email = $1',
      [email]
    );
    if (!user) {
      return jsonError(BAD_CREDENTIALS, 401);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return jsonError(BAD_CREDENTIALS, 401);
    }

    await createSession({
      id: user.id,
      email: user.email,
      encryptionSalt: user.encryptionSalt,
      status: user.status,
    });

    return NextResponse.json({
      user: publicUser(user),
      redirectTo: redirectAfterLogin(user.status),
    });
  } catch (error) {
    console.error("Login error:", error);
    return jsonError("Failed to sign in");
  }
}
