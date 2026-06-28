import { NextResponse } from "next/server";
import { queryOne } from "@/lib/server-db";
import { getSession } from "@/lib/session";
import { sendConfirmationEmail } from "@/lib/email";
import { generateAuthCode, getAuthCodeExpiresAt, hashAuthCode } from "@/lib/auth-codes";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

interface UserRow {
  id: string;
  email: string;
  status: "pending_email" | "pending_recovery" | "active";
}

const RESEND_LIMIT = 5;
const RESEND_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimit = checkRateLimit(
      `confirm-email-resend:${ip}`,
      RESEND_LIMIT,
      RESEND_WINDOW_MS
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many resend attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfter),
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
          },
        }
      );
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await queryOne<UserRow>(
      'SELECT id, email, status FROM "User" WHERE id = $1',
      [session.id]
    );

    if (!user || user.status !== "pending_email") {
      return NextResponse.json(
        { error: "Email is already confirmed" },
        { status: 400 }
      );
    }

    const code = generateAuthCode();
    const codeHash = await hashAuthCode(code);
    const expiresAt = getAuthCodeExpiresAt();

    await queryOne<UserRow>(
      `UPDATE "User"
       SET "emailConfirmationCodeHash" = $1,
           "emailConfirmationCodeExpiresAt" = $2,
           "updatedAt" = NOW()
       WHERE id = $3
       RETURNING id, email, status`,
      [codeHash, expiresAt, user.id]
    );

    try {
      await sendConfirmationEmail(user.email, code);
    } catch (emailError) {
      console.error("Failed to resend confirmation email:", emailError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Resend confirmation error:", error);
    return NextResponse.json(
      { error: "Failed to resend confirmation code" },
      { status: 500 }
    );
  }
}
