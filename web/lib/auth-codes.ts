import bcrypt from "bcryptjs";
import { randomInt } from "crypto";

export const AUTH_CODE_LENGTH = 6;
export const AUTH_CODE_TTL_MINUTES = 15;

export function generateAuthCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(AUTH_CODE_LENGTH, "0");
}

export function getAuthCodeExpiresAt(): Date {
  return new Date(Date.now() + AUTH_CODE_TTL_MINUTES * 60 * 1000);
}

export function isValidAuthCodeFormat(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export async function hashAuthCode(code: string): Promise<string> {
  return bcrypt.hash(code, 12);
}

export async function verifyAuthCode(code: string, hash: string): Promise<boolean> {
  if (!isValidAuthCodeFormat(code)) return false;
  return bcrypt.compare(code, hash);
}
