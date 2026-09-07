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
 * 재시도해도 결과가 달라질 가망이 없는 실패인가.
 * 지금은 타임아웃만 해당한다 — 네트워크 단절도 후보지만, 일시적 끊김은 재시도로
 * 회복되는 경우가 있어 굳이 막지 않는다.
 */
export function isUnretryableAiError(error: unknown): boolean {
  return error instanceof AiTimeoutError;
}
