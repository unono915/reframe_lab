import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiTimeoutError, isUnretryableAiError } from "@/lib/ai/errors";
import { upstageCoachProvider } from "@/lib/ai/providers/upstage";
import type { CoachRequestContext } from "@/lib/ai/provider";

/**
 * 실제 Upstage 서버를 부르지 않고, **호출자가 실패를 어떻게 구분하게 되는지**만
 * 확인한다. Route Handler의 재시도 정책이 이 구분에 걸려 있기 때문이다:
 * 타임아웃이면 재시도하지 않고 바로 fallback으로 가야 사용자가 20초만 기다린다
 * (그러지 않으면 40초를 기다렸다 — 2026-09-08 E2E에서 실제로 드러났다).
 */
const CONTEXT: CoachRequestContext = {
  stage: "observation",
  hintLevel: 0,
  userText: "회의에서 아무도 반대 의견을 내지 않았다",
  recentQuestions: [],
};

beforeEach(() => {
  vi.stubEnv("UPSTAGE_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("upstageCoachProvider — 실패를 구분 가능한 형태로 던진다", () => {
  it("요청이 중단되면(타임아웃) AiTimeoutError로 바꿔 던진다", async () => {
    // AbortController가 끊은 요청은 name이 "AbortError"인 예외로 올라온다.
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(abortError)),
    );

    await expect(upstageCoachProvider.getCoachResponse(CONTEXT)).rejects.toBeInstanceOf(
      AiTimeoutError,
    );
  });

  it("그 오류는 '재시도하지 말 것'으로 분류된다", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(abortError)),
    );

    const error = await upstageCoachProvider
      .getCoachResponse(CONTEXT)
      .catch((e: unknown) => e);
    expect(isUnretryableAiError(error)).toBe(true);
  });

  it("서버 오류(5xx)는 타임아웃과 달리 재시도 대상으로 남는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("", { status: 502 }))),
    );

    const error = await upstageCoachProvider
      .getCoachResponse(CONTEXT)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(isUnretryableAiError(error)).toBe(false);
  });

  it.each([
    [400, "요청 형식이 틀렸다"],
    [401, "API Key가 틀렸다"],
    [429, "호출량을 넘었다"],
  ])("제공자가 %i로 거절하면 재시도하지 않는다 (%s)", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("", { status }))),
    );

    const error = await upstageCoachProvider
      .getCoachResponse(CONTEXT)
      .catch((e: unknown) => e);
    // 같은 요청을 그대로 다시 보내도 같은 답이 온다 — 20초를 한 번 더 쓰지 않는다.
    expect(isUnretryableAiError(error)).toBe(true);
  });

  it("408(요청 타임아웃)은 일시적일 수 있어 재시도 대상으로 남긴다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("", { status: 408 }))),
    );

    const error = await upstageCoachProvider
      .getCoachResponse(CONTEXT)
      .catch((e: unknown) => e);
    expect(isUnretryableAiError(error)).toBe(false);
  });

  it("응답에 content가 없으면 오류로 알린다 — 조용히 빈 값을 돌려주지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 }),
        ),
      ),
    );

    await expect(upstageCoachProvider.getCoachResponse(CONTEXT)).rejects.toThrow(
      /content/,
    );
  });

  it("API Key가 없으면 호출 전에 멈춘다", async () => {
    vi.stubEnv("UPSTAGE_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(upstageCoachProvider.getCoachResponse(CONTEXT)).rejects.toThrow(
      /UPSTAGE_API_KEY/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("not_started 단계는 애초에 호출하지 않는다 (원칙 1)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      upstageCoachProvider.getCoachResponse({ ...CONTEXT, stage: "not_started" }),
    ).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("upstageCoachProvider — 사용자 입력을 프롬프트에 격리해 담는다", () => {
  it("사용자 텍스트를 요청 본문에 담되, 시스템 프롬프트와 분리된 자리에 넣는다", async () => {
    const fetchSpy = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
          }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await upstageCoachProvider.getCoachResponse(CONTEXT);

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    const roles = body.messages.map((m: { role: string }) => m.role);
    expect(roles).toEqual(["system", "user"]);

    const system = body.messages[0].content as string;
    const user = body.messages[1].content as string;
    // 사용자 문장은 user 메시지에만 있어야 한다 — 지시문 자리에 섞이면 안 된다.
    expect(user).toContain(CONTEXT.userText);
    expect(system).not.toContain(CONTEXT.userText);
  });

  it("Structured Output을 스키마로 강제한다 — 형식을 모델의 선의에 맡기지 않는다", async () => {
    const fetchSpy = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), {
          status: 200,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await upstageCoachProvider.getCoachResponse(CONTEXT);

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(body.response_format?.type).toBe("json_schema");
    expect(body.max_tokens).toBeGreaterThan(0);
  });
});
