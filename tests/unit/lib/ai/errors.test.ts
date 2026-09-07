import { describe, expect, it } from "vitest";
import {
  AiRejectedError,
  AiTimeoutError,
  describeAiFailure,
  isUnretryableAiError,
} from "@/lib/ai/errors";

/**
 * 재시도 정책의 회귀 테스트. 원래 Route Handler는 `catch { continue; }`로 모든
 * 실패를 재시도해서, 제공자가 느리면 20초 타임아웃을 두 번 쓰고 사용자가 40초를
 * 기다렸다(2026-09-08 E2E에서 30초 타임아웃을 넘겨 실제로 드러났다).
 */
describe("isUnretryableAiError", () => {
  it("타임아웃은 재시도하지 않는다 — 다시 걸어도 같은 시간을 또 쓸 뿐이다", () => {
    expect(isUnretryableAiError(new AiTimeoutError(20_000))).toBe(true);
  });

  it("제공자의 4xx 거절도 재시도하지 않는다 — 같은 요청은 같은 답을 받는다", () => {
    expect(isUnretryableAiError(new AiRejectedError(401))).toBe(true);
    expect(isUnretryableAiError(new AiRejectedError(429))).toBe(true);
  });

  it("스키마·Guardrail 실패에 해당하는 일반 오류는 재시도한다", () => {
    // 모델이 한 번 잘못 뽑은 것이라 다시 뽑으면 대개 통과한다.
    expect(isUnretryableAiError(new Error("Upstage API 오류 (500)"))).toBe(false);
  });

  it("Error가 아닌 값이 던져져도 안전하게 판단한다", () => {
    expect(isUnretryableAiError("문자열이 throw됨")).toBe(false);
    expect(isUnretryableAiError(undefined)).toBe(false);
    expect(isUnretryableAiError(null)).toBe(false);
  });
});

describe("AiTimeoutError", () => {
  it("이름과 메시지에 대기 시간을 남긴다 — 로그에서 원인을 알 수 있어야 한다", () => {
    const error = new AiTimeoutError(20_000);
    expect(error.name).toBe("AiTimeoutError");
    expect(error.message).toContain("20000");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("AiRejectedError", () => {
  it("상태 코드를 보존한다 — 401(키 문제)과 429(한도)는 대응이 다르다", () => {
    const error = new AiRejectedError(429);
    expect(error.name).toBe("AiRejectedError");
    expect(error.status).toBe(429);
    expect(error.message).toContain("429");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("describeAiFailure", () => {
  /**
   * 이 문자열은 `coach_interactions.error_code`에 그대로 저장된다. 지금까지는 모든
   * 실패가 `guardrail_or_schema_failed` 하나였고, 그래서 fallback이 늘어도 프롬프트
   * 문제인지 모델이 흔들린 것인지 구분할 수 없었다. 나중에 이 값을 세어보는 것이
   * 코칭 품질을 판단할 유일한 근거라 원인이 서로 섞이면 안 된다.
   */
  it("원인마다 다른 코드를 준다", () => {
    expect(describeAiFailure(new AiTimeoutError(20_000))).toBe("provider_timeout");
    expect(describeAiFailure(new AiRejectedError(429))).toBe("provider_rejected_429");
    expect(describeAiFailure(new AiRejectedError(401))).toBe("provider_rejected_401");
    expect(describeAiFailure(new Error("소켓이 끊김"))).toBe("provider_error");
  });

  it("Error가 아닌 값이 던져져도 코드를 만들어낸다", () => {
    expect(describeAiFailure("문자열이 throw됨")).toBe("provider_error");
    expect(describeAiFailure(undefined)).toBe("provider_error");
  });

  it("상태 코드가 다르면 코드도 다르다 — 401(키)과 429(한도)는 대응이 다르다", () => {
    expect(describeAiFailure(new AiRejectedError(401))).not.toBe(
      describeAiFailure(new AiRejectedError(429)),
    );
  });
});
