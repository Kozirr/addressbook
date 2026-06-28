import { describe, expect, it } from "vitest";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

describe("rate limit", () => {
  it("allows requests until the limit is reached", () => {
    const key = `test:${crypto.randomUUID()}`;

    expect(checkRateLimit(key, 2, 60_000, 1_000).allowed).toBe(true);
    const second = checkRateLimit(key, 2, 60_000, 2_000);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);

    const third = checkRateLimit(key, 2, 60_000, 3_000);
    expect(third.allowed).toBe(false);
    expect(third.retryAfter).toBe(58);
  });

  it("resets after the window expires", () => {
    const key = `test:${crypto.randomUUID()}`;

    expect(checkRateLimit(key, 1, 60_000, 1_000).allowed).toBe(true);
    expect(checkRateLimit(key, 1, 60_000, 2_000).allowed).toBe(false);
    expect(checkRateLimit(key, 1, 60_000, 61_000).allowed).toBe(true);
  });

  it("reads the first forwarded IP address", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10, 198.51.100.20",
    });

    expect(getClientIp(headers)).toBe("203.0.113.10");
  });
});
