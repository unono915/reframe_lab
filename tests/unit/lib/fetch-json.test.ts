import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson, NETWORK_ERROR_MESSAGE, toUserMessage } from "@/lib/fetch-json";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(impl: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

describe("fetchJson — 성공", () => {
  it("2xx면 파싱한 본문을 돌려준다", async () => {
    stubFetch(async () => new Response(JSON.stringify({ sessions: [1, 2] }), { status: 200 }));
    const result = await fetchJson<{ sessions: number[] }>("/api/history");
    expect(result).toEqual({ ok: true, data: { sessions: [1, 2] } });
  });

  it("204 No Content는 본문 파싱을 시도하지 않는다", async () => {
    stubFetch(async () => new Response(null, { status: 204 }));
    const result = await fetchJson("/api/sessions/x");
    expect(result.ok).toBe(true);
  });
});

/**
 * 이 describe가 이 파일의 존재 이유다. 예전에는 화면들이 `res.json()`을 곧바로
 * 불러서, 아래 각 상황마다 SyntaxError가 unhandled rejection으로 새어나가고 화면이
 * 로딩 문구에서 영영 멈췄다(실제 재현됨).
 */
describe("fetchJson — 실패해도 절대 throw하지 않는다", () => {
  it("네트워크가 끊기면 연결 안내 메시지를 돌려준다", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    const result = await fetchJson("/api/history");
    expect(result).toEqual({ ok: false, message: NETWORK_ERROR_MESSAGE });
  });

  it("본문이 빈 500 응답에서도 throw하지 않는다", async () => {
    stubFetch(async () => new Response("", { status: 500 }));
    const result = await fetchJson("/api/history");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });

  it("서버가 준 오류 메시지가 있으면 그대로 사용자에게 전한다", async () => {
    stubFetch(
      async () =>
        new Response(JSON.stringify({ errorCode: "requirement_not_met", message: "먼저 작성해주세요." }), {
          status: 422,
        }),
    );
    const result = await fetchJson("/api/sessions/x/coach");
    expect(result).toEqual({ ok: false, message: "먼저 작성해주세요." });
  });

  it("2xx인데 본문이 JSON이 아니면 실패로 처리한다", async () => {
    stubFetch(async () => new Response("<!doctype html>", { status: 200 }));
    const result = await fetchJson("/api/history");
    expect(result.ok).toBe(false);
  });

  it("어떤 실패 메시지도 영어 원문을 노출하지 않는다", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    const result = await fetchJson("/api/history");
    if (!result.ok) expect(result.message).not.toMatch(/fetch|Error|undefined/i);
  });
});

describe("toUserMessage", () => {
  it("TypeError(네트워크 단절)는 연결 안내로 바꾼다", () => {
    expect(toUserMessage(new TypeError("Failed to fetch"))).toBe(NETWORK_ERROR_MESSAGE);
  });

  it("그 밖의 예외도 한국어 문장으로 바꾼다 — 원문을 그대로 쓰지 않는다", () => {
    const message = toUserMessage(new Error("Unexpected end of JSON input"));
    expect(message).not.toContain("JSON");
    expect(message).toContain("작성한 내용은 그대로 있어요");
  });

  it("Error가 아닌 값이 던져져도 안전하게 처리한다", () => {
    expect(typeof toUserMessage("문자열이 throw됨")).toBe("string");
    expect(typeof toUserMessage(undefined)).toBe("string");
  });
});
