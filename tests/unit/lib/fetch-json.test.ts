import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchJson,
  handleUnauthorized,
  NETWORK_ERROR_MESSAGE,
  toDisplayMessage,
  toUserMessage,
  UserFacingError,
} from "@/lib/fetch-json";

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

describe("toDisplayMessage — 우리 메시지와 브라우저 예외를 가른다", () => {
  it("UserFacingError의 메시지는 그대로 보여준다", () => {
    expect(toDisplayMessage(new UserFacingError("오늘의 렌즈를 불러오지 못했어요."))).toBe(
      "오늘의 렌즈를 불러오지 못했어요.",
    );
  });

  it("네트워크 예외는 연결 안내로 바꾼다 — 영어 원문을 그대로 두지 않는다", () => {
    const message = toDisplayMessage(new TypeError("Failed to fetch"));
    expect(message).toBe(NETWORK_ERROR_MESSAGE);
    expect(message).not.toMatch(/fetch/i);
  });

  it("라이브러리가 던진 영어 예외도 그대로 노출하지 않는다", () => {
    // IndexedDB·Supabase SDK 등이 던지는 영어 메시지가 화면에 뜨면 안 된다.
    const message = toDisplayMessage(new Error("QuotaExceededError: storage full"));
    expect(message).not.toContain("QuotaExceeded");
    expect(message).toContain("작성한 내용은 그대로 있어요");
  });
});

/**
 * 세션이 풀렸을 때의 이동. 예전에는 미인증 API 요청이 로그인 **HTML**로
 * 리다이렉트돼서, `response.json()`이 깨지고 사용자에게는 "잠시 문제가 생겼어요"만
 * 남았다 — 재시도해도 달라지지 않는 화면이다.
 *
 * 여기서 잠그는 것은 세 가지다: ① 401이면 실제로 이동한다 ② 원래 자리를 `next`에
 * 담는다 ③ **로그인 화면에서는 다시 이동하지 않는다**(리다이렉트 루프는 세션이 풀린
 * 사용자를 앱에서 완전히 내보낸다).
 */
describe("handleUnauthorized", () => {
  function stubLocation(pathname: string, search = "") {
    const assign = vi.fn();
    vi.stubGlobal("window", {
      location: { pathname, search, assign },
    });
    return assign;
  }

  it("401이면 로그인으로 보내고, 원래 자리를 next에 담는다", () => {
    const assign = stubLocation("/history", "?offset=50");
    expect(handleUnauthorized(401, null)).toBe(true);
    expect(assign).toHaveBeenCalledWith(
      `/auth/login?next=${encodeURIComponent("/history?offset=50")}`,
    );
  });

  it("상태가 401이 아니어도 errorCode가 unauthorized면 같은 처리를 한다", () => {
    const assign = stubLocation("/growth");
    expect(handleUnauthorized(500, { errorCode: "unauthorized" })).toBe(true);
    expect(assign).toHaveBeenCalledOnce();
  });

  it("이미 로그인 화면이면 다시 이동하지 않는다 — 리다이렉트 루프 방지", () => {
    const assign = stubLocation("/auth/login", "?next=%2Fhistory");
    expect(handleUnauthorized(401, null)).toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });

  it("401이 아닌 실패는 화면을 옮기지 않는다", () => {
    const assign = stubLocation("/history");
    expect(handleUnauthorized(500, { errorCode: "internal_error" })).toBe(false);
    expect(handleUnauthorized(404, null)).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("fetchJson — 세션 만료", () => {
  it("401을 받으면 서버 문구를 보여주면서 로그인으로 보낸다", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { pathname: "/history", search: "", assign } });
    stubFetch(
      async () =>
        new Response(
          JSON.stringify({ errorCode: "unauthorized", message: "로그인이 풀렸어요." }),
          { status: 401 },
        ),
    );

    const result = await fetchJson("/api/history");
    expect(result).toEqual({ ok: false, message: "로그인이 풀렸어요." });
    // 메시지만 보여주고 끝내면 사용자는 재시도 버튼 앞에 갇힌다.
    expect(assign).toHaveBeenCalledOnce();
  });
});
