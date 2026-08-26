/**
 * 사용자 단위 Rate Limit (DEVELOPMENT_PLAN.md §8.8). 인메모리 토큰 버킷이라
 * 서버 재시작·다중 인스턴스 배포에서는 초기화된다 — 개인 파일럿 규모에서는
 * 충분하고, 진짜 방어선은 `training_sessions.ai_call_count` 상한
 * (`SESSION_AI_CALL_CAP`, DB에 영구 기록됨)이다. 이 파일은 짧은 시간에 몰린
 * 연속 호출(예: 버튼 연타)만 걸러내는 보조 장치다.
 */

const WINDOW_MS = 60_000;
const MAX_CALLS_PER_WINDOW = 10;

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterMs?: number;
}

export function checkRateLimit(
  userId: string,
  now: number = Date.now(),
  windowMs = WINDOW_MS,
  maxCalls = MAX_CALLS_PER_WINDOW,
): RateLimitResult {
  const bucket = buckets.get(userId);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(userId, { count: 1, windowStart: now });
    return { ok: true };
  }
  if (bucket.count < maxCalls) {
    bucket.count += 1;
    return { ok: true };
  }
  return { ok: false, retryAfterMs: windowMs - (now - bucket.windowStart) };
}

/** 세션당 AI 호출 상한 (DEVELOPMENT_PLAN.md §15.1 A6, 초기 권장값 — 파일럿 후 조정). */
export const SESSION_AI_CALL_CAP = 15;
