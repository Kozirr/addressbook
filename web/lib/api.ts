import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, SessionUser } from "@/lib/session";

export function jsonError(error: string, status = 500) {
  return NextResponse.json({ error }, { status });
}

export function jsonValidationError(error: z.ZodError) {
  return jsonError(error.issues[0]?.message ?? "Invalid request", 400);
}

export async function parseJsonBody<T>(
  request: NextRequest,
  schema: z.ZodType<T>
): Promise<{ data: T } | { response: NextResponse }> {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return { response: jsonValidationError(parsed.error) };
    }
    return { data: parsed.data };
  } catch {
    return { response: jsonError("Invalid JSON body", 400) };
  }
}

export async function requireSession(): Promise<
  { session: SessionUser } | { response: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { response: jsonError("Unauthorized", 401) };
  }
  return { session };
}

export function statusFromError(error: unknown, fallback = 500) {
  if (error instanceof Error && "statusCode" in error) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode;
    if (statusCode) return statusCode;
  }
  return fallback;
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
