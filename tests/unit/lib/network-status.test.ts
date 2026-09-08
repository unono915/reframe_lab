import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isOffline,
  reportNetworkFailure,
  reportNetworkSuccess,
  resetNetworkStatusForTest,
  subscribeNetworkStatus,
  trackedFetch,
} from "@/lib/network-status";

/**
 * 이 모듈이 있는 이유는 하나다: **`navigator.onLine`을 믿을 수 없어서.**
 *
 * 오프라인 상태로 앱을 연 뒤 측정했더니, 요청이 전부 `net::ERR_FAILED`로 죽는데도
 * `navigator.onLine === true`였다(2026-09-08). 캡티브 포털(로그인 안 한 공용
 * 와이파이)도 같은 모양이다 — 인터페이스는 붙어 있고 요청만 가로채인다.
 *
 * 그래서 관측이 신고를 이긴다. 아래 테스트가 잠그는 것이 그 규칙이다.
 */
afterEach(() => {
  resetNetworkStatusForTest();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  resetNetworkStatusForTest();
});

describe("isOffline", () => {
  it("브라우저가 온라인이라 해도, 요청이 실패했다면 오프라인으로 본다", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(isOffline()).toBe(false);

    reportNetworkFailure();
    expect(isOffline()).toBe(true);
  });

  it("응답을 하나라도 받으면 다시 온라인으로 본다", () => {
    vi.stubGlobal("navigator", { onLine: true });
    reportNetworkFailure();
    reportNetworkSuccess();
    expect(isOffline()).toBe(false);
  });

  it("브라우저가 오프라인이라고 하면 관측 없이도 오프라인이다", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(isOffline()).toBe(true);
  });
});

describe("subscribeNetworkStatus", () => {
  it("상태가 바뀔 때만 알린다 — 같은 값으로 반복 통지하지 않는다", () => {
    vi.stubGlobal("navigator", { onLine: true });
    const seen: boolean[] = [];
    const unsubscribe = subscribeNetworkStatus((offline) => seen.push(offline));

    reportNetworkFailure();
    reportNetworkFailure();
    reportNetworkSuccess();
    reportNetworkSuccess();

    expect(seen).toEqual([true, false]);
    unsubscribe();
  });

  it("구독을 끊으면 더 이상 받지 않는다", () => {
    vi.stubGlobal("navigator", { onLine: true });
    const seen: boolean[] = [];
    const unsubscribe = subscribeNetworkStatus((offline) => seen.push(offline));
    unsubscribe();

    reportNetworkFailure();
    expect(seen).toEqual([]);
  });
});

describe("trackedFetch", () => {
  it("응답을 받으면 상태 코드와 무관하게 온라인이다 — 500도 서버에는 닿은 것이다", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    reportNetworkFailure();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );

    await trackedFetch("/api/x");
    expect(isOffline()).toBe(false);
  });

  it("연결 자체가 실패하면 오프라인으로 기록하고 예외는 그대로 던진다", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(trackedFetch("/api/x")).rejects.toThrow(TypeError);
    // 호출부가 오류를 처리할 기회를 잃지 않아야 한다 — 여기서 삼키면 안 된다.
    expect(isOffline()).toBe(true);
  });
});
