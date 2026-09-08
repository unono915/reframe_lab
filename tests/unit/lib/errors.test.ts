import { describe, expect, it } from "vitest";
import { apiError, type ApiErrorCode } from "@/lib/errors";

/**
 * API 오류 계약의 회귀 테스트.
 *
 * 모든 Route Handler가 이 한 함수로 실패를 알리고, 화면은 `errorCode`로 분기하며
 * `message`를 **그대로 사용자에게 보여준다**(`lib/fetch-json.ts`). 그래서 여기서
 * 잘못되면 잘못된 상태 코드나 영어 문구가 곧바로 사용자 화면에 닿는다.
 *
 * 그런데 이 파일에는 테스트가 하나도 없었다.
 */
const CODES: ApiErrorCode[] = [
  "unauthorized",
  "not_found",
  "validation_error",
  "wrong_state_version",
  "requirement_not_met",
  "invalid_transition",
  "internal_error",
];

/** 코드마다 의미가 정해져 있다 — 특히 401·404·409·422는 화면이 다르게 다룬다. */
const EXPECTED_STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  not_found: 404,
  validation_error: 400,
  wrong_state_version: 409,
  requirement_not_met: 422,
  invalid_transition: 409,
  internal_error: 500,
};

async function readBody(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe("apiError", () => {
  it("코드마다 정해진 상태로 나간다", () => {
    for (const code of CODES) {
      expect(apiError(code).status, code).toBe(EXPECTED_STATUS[code]);
    }
  });

  it("기본 문구는 비어 있지 않은 한국어다", async () => {
    for (const code of CODES) {
      const body = await readBody(apiError(code));
      const message = body.message;
      expect(typeof message, code).toBe("string");
      expect((message as string).trim().length, code).toBeGreaterThan(0);
      // 브라우저·라이브러리가 던지는 영어 원문이 그대로 나가면 안 된다.
      expect(message as string, code).toMatch(/[가-힣]/);
    }
  });

  it("코드를 그대로 실어 보낸다 — 화면이 그것으로 분기한다", async () => {
    for (const code of CODES) {
      expect((await readBody(apiError(code))).errorCode, code).toBe(code);
    }
  });

  it("라우트가 더 구체적인 문구를 주면 그것을 쓴다", async () => {
    const body = await readBody(
      apiError("validation_error", "오늘의 렌즈를 찾을 수 없어요."),
    );
    expect(body.message).toBe("오늘의 렌즈를 찾을 수 없어요.");
    expect(body.errorCode).toBe("validation_error");
  });

  it("덧붙이는 값이 코드·문구를 덮어쓰지 않는다", async () => {
    // 전환 실패는 최신 스냅샷을 함께 보낸다(`advance`·`abandon` 라우트). 그때
    // 오류 코드가 가려지면 화면이 실패를 성공처럼 다루게 된다.
    const body = await readBody(
      apiError("invalid_transition", undefined, { snapshot: { id: "s-1" } }),
    );
    expect(body.errorCode).toBe("invalid_transition");
    expect(typeof body.message).toBe("string");
    expect(body.snapshot).toEqual({ id: "s-1" });
  });
});
