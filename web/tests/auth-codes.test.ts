import { describe, it, expect } from "vitest";
import {
  AUTH_CODE_LENGTH,
  generateAuthCode,
  getAuthCodeExpiresAt,
  hashAuthCode,
  isValidAuthCodeFormat,
  verifyAuthCode,
} from "@/lib/auth-codes";

describe("auth codes", () => {
  it("generates 6-digit codes", () => {
    const code = generateAuthCode();
    expect(code).toHaveLength(AUTH_CODE_LENGTH);
    expect(isValidAuthCodeFormat(code)).toBe(true);
  });

  it("hashes and verifies codes", async () => {
    const code = "123456";
    const hash = await hashAuthCode(code);
    expect(await verifyAuthCode(code, hash)).toBe(true);
    expect(await verifyAuthCode("654321", hash)).toBe(false);
    expect(await verifyAuthCode("not-code", hash)).toBe(false);
  });

  it("sets future expiry dates", () => {
    expect(getAuthCodeExpiresAt().getTime()).toBeGreaterThan(Date.now());
  });
});
