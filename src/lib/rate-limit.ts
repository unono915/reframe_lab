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

/**
 * 버킷을 정리하기 시작하는 크기. 이 Map은 사용자가 나타날 때마다 항목이 늘기만 하고
 * 줄지 않아서, 프로세스가 오래 살아 있으면 창이 지난 지 한참 된 항목까지 계속 들고
 * 있게 된다 — `idempotency_keys`가 만료 없이 자라던 것과 같은 모양이다(migration 0009).
 * 여기서는 창이 지난 항목이 곧 쓸모없는 항목이라 판정이 간단하다.
 */
const SWEEP_THRESHOLD = 10_000;

function sweepExpired(now: number, windowMs: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= windowMs) buckets.delete(key);
  }
}

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
    // 정리는 새 창을 여는 순간에만, 그것도 임계치를 넘었을 때만 한다 — 매 호출마다
    // 전체를 훑으면 Rate Limit 검사 자체가 사용자 수에 비례해 느려진다.
    if (buckets.size > SWEEP_THRESHOLD) sweepExpired(now, windowMs);
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
