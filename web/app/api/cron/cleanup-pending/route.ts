import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/server-db";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const expected = process.env.CRON_SECRET;
    if (expected && authHeader !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await query<{ id: string }>(
      `DELETE FROM "User"
       WHERE status = 'pending_email'
         AND "createdAt" < NOW() - INTERVAL '24 hours'
       RETURNING id`
    );

    return NextResponse.json({ deleted: result.length });
  } catch (error) {
    console.error("Cleanup pending users error:", error);
    return NextResponse.json(
      { error: "Cleanup failed" },
      { status: 500 }
    );
  }
}
