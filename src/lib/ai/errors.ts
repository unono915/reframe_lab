/**
 * AI 호출 실패를 "다시 걸어볼 가치가 있는가"로 나눈다.
 *
 * Route Handler의 재시도 루프는 원래 `catch { continue; }`라 **모든** 실패를 똑같이
 * 재시도했다. 그래서 제공자가 느려 20초 타임아웃에 걸리면 같은 요청을 한 번 더 걸어
 * 사용자가 40초를 기다린 뒤에야 fallback을 봤다(2026-09-08 E2E에서 실제로 30초를
 * 넘겨 실패). 타임아웃은 재시도한다고 빨라지지 않는다 — 반면 스키마·Guardrail
 * 위반은 모델이 한 번 잘못 뽑은 것이라 다시 뽑으면 대개 통과한다.
 *
 * 그래서 재시도는 "빨리 실패했고 다시 뽑으면 달라질 수 있는" 경우로 한정한다.
 */
export class AiTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`AI 요청이 ${timeoutMs}ms 안에 끝나지 않았습니다.`);
    this.name = "AiTimeoutError";
  }
}

/**
 * 제공자가 4xx로 거절한 경우. 같은 요청을 그대로 다시 보내면 같은 답이 온다 —
 * 잘못된 API Key(401·403), 스키마·파라미터 오류(400), 호출량 초과(429)가 여기 해당한다.
 * 5xx는 포함하지 않는다: 제공자 쪽 일시 장애는 재시도로 회복되는 경우가 있다.
 */
export class AiRejectedError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`AI 제공자가 요청을 거절했습니다 (${status}).`);
    this.name = "AiRejectedError";
    this.status = status;
  }
}

/**
 * 재시도해도 결과가 달라질 가망이 없는 실패인가.
 * 타임아웃과 제공자의 4xx 거절이 해당한다 — 네트워크 단절도 후보지만, 일시적 끊김은
 * 재시도로 회복되는 경우가 있어 굳이 막지 않는다.
 */
export function isUnretryableAiError(error: unknown): boolean {
  return error instanceof AiTimeoutError || error instanceof AiRejectedError;
}

/**
 * 제공자 호출이 던진 예외를 기록용 코드 한 단어로 바꾼다.
 *
 * `coach_interactions.error_code`·`ai_feedbacks.error_code`에 그대로 들어간다.
 * 지금까지 모든 실패가 `guardrail_or_schema_failed` 하나로 뭉뚱그려져 있어서,
 * fallback이 늘어도 **프롬프트를 고쳐야 하는지 모델이 흔들리는지 구분할 수 없었다.**
 * 나중에 이 값을 세어보는 것이 이 앱에서 AI 코칭 품질을 판단할 유일한 근거다.
 */
export function describeAiFailure(error: unknown): string {
  if (error instanceof AiTimeoutError) return "provider_timeout";
  if (error instanceof AiRejectedError) return `provider_rejected_${error.status}`;
  return "provider_error";
}
