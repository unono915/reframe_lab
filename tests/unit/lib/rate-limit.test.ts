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

describe("checkRateLimit — 버킷이 무한히 쌓이지 않는다", () => {
  it("사용자가 계속 늘어나도 창이 지난 항목은 정리된다", () => {
    // 이 Map은 항목이 늘기만 하고 줄지 않아, 프로세스가 오래 살면 창이 지난 지
    // 한참 된 항목까지 계속 들고 있게 된다(idempotency_keys가 만료 없이 자라던
    // 것과 같은 모양이다). 여기서는 "창이 지났으면 쓸모없다"가 곧 판정이다.
    const windowMs = 60_000;
    const start = 1_000_000;

    // 임계치를 넘도록 서로 다른 사용자를 만든다.
    for (let i = 0; i < 10_050; i += 1) {
      checkRateLimit(`sweep-user-${i}`, start, windowMs, 10);
    }

    // 창이 한참 지난 뒤 새 사용자가 들어오면 그 순간 정리가 돈다.
    const later = start + windowMs * 2;
    const result = checkRateLimit("sweep-trigger", later, windowMs, 10);
    expect(result.ok).toBe(true);

    // 정리 뒤에도 판정은 그대로여야 한다 — 지운 것은 만료된 항목뿐이다.
    for (let i = 0; i < 10; i += 1) {
      expect(checkRateLimit("sweep-trigger", later, windowMs, 10).ok).toBe(i < 9);
    }
  });
});
