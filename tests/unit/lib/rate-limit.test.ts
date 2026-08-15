import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  it("allows calls under the limit within the window", () => {
    const userId = `user-${Math.random()}`;
    const now = 1_000_000;
    for (let i = 0; i < 5; i += 1) {
      expect(checkRateLimit(userId, now, 60_000, 5 + 1).ok).toBe(true);
    }
  });

  it("blocks once the limit is reached within the window", () => {
    const userId = `user-${Math.random()}`;
    const now = 1_000_000;
    for (let i = 0; i < 3; i += 1) {
      checkRateLimit(userId, now, 60_000, 3);
    }
    const result = checkRateLimit(userId, now, 60_000, 3);
    expect(result.ok).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets once the window elapses", () => {
    const userId = `user-${Math.random()}`;
    checkRateLimit(userId, 0, 1000, 1);
    const blocked = checkRateLimit(userId, 500, 1000, 1);
    expect(blocked.ok).toBe(false);
    const afterWindow = checkRateLimit(userId, 1500, 1000, 1);
    expect(afterWindow.ok).toBe(true);
  });

  it("tracks separate users independently", () => {
    const now = 1_000_000;
    checkRateLimit("user-a", now, 60_000, 1);
    const userB = checkRateLimit("user-b", now, 60_000, 1);
    expect(userB.ok).toBe(true);
  });
});
