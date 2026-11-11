import { describe, expect, it } from "vitest";
import { createLoginRateLimiter, getClientIp } from "@/lib/auth/login-rate-limit";

const WINDOW_MS = 5 * 60 * 1000;

describe("createLoginRateLimiter", () => {
  it("5번 틀릴 때까지는 막지 않고, 5번째부터 막는다", () => {
    const limiter = createLoginRateLimiter({ maxFailures: 5, windowMs: WINDOW_MS });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      limiter.recordFailure("1.1.1.1", 1_000);
    }
    expect(limiter.getBlockedMs("1.1.1.1", 1_000)).toBe(0);
    limiter.recordFailure("1.1.1.1", 2_000);
    expect(limiter.getBlockedMs("1.1.1.1", 2_000)).toBe(WINDOW_MS - 1_000);
  });

  it("IP마다 따로 센다", () => {
    const limiter = createLoginRateLimiter({ maxFailures: 1, windowMs: WINDOW_MS });
    limiter.recordFailure("1.1.1.1", 0);
    expect(limiter.getBlockedMs("1.1.1.1", 0)).toBeGreaterThan(0);
    expect(limiter.getBlockedMs("2.2.2.2", 0)).toBe(0);
  });

  it("5분이 지나면 풀린다", () => {
    const limiter = createLoginRateLimiter({ maxFailures: 1, windowMs: WINDOW_MS });
    limiter.recordFailure("1.1.1.1", 0);
    expect(limiter.getBlockedMs("1.1.1.1", WINDOW_MS)).toBe(0);
  });

  it("reset하면 다시 센다", () => {
    const limiter = createLoginRateLimiter({ maxFailures: 1, windowMs: WINDOW_MS });
    limiter.recordFailure("1.1.1.1", 0);
    limiter.reset("1.1.1.1");
    expect(limiter.getBlockedMs("1.1.1.1", 0)).toBe(0);
  });
});

describe("getClientIp", () => {
  it("x-forwarded-for 맨 앞 주소를 쓴다", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "3.3.3.3, 10.0.0.1" }))).toBe("3.3.3.3");
  });

  it("없으면 x-real-ip, 그것도 없으면 unknown", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "4.4.4.4" }))).toBe("4.4.4.4");
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});
