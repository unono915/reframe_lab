import type { SessionSummary } from "@/domain/types";

/**
 * "다시 볼 만한 기록" 제안 (PRD §6.5 P1).
 *
 * 왜 시간 간격을 두는가 — 같은 내용을 이어서 다시 보는 것보다 **간격을 두고 다시
 * 인출할 때** 기억과 이해가 더 깊어진다(분산 학습·간격 인출). 그리고 이 앱에서
 * 더 중요한 이유가 하나 더 있다: 방금 쓴 정의는 아직 내 머릿속 맥락이 남아 있어
 * "무엇이 빠졌는지"가 보이지 않는다. 2주쯤 지나 맥락이 흐려진 뒤에 읽어야 문장이
 * 실제로 무엇을 담고 있는지 보인다.
 *
 * 자동으로 새 세션을 만들지 않는다 — 제안만 하고 시작 여부는 사용자가 정한다
 * (PRD §6.5 P0 "사용자가 과거 기록을 직접 선택하여 시작한다"와 충돌하지 않게).
 */

/** 최소 간격. PRD §6.5 P1의 "14일 또는 30일" 중 짧은 쪽을 기준으로 잡는다. */
export const REVISIT_MIN_DAYS = 14;

function daysBetween(fromDate: string, toDate: string): number {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.floor((to - from) / 86_400_000);
}

/**
 * 다시 볼 후보 하나를 고른다. 없으면 null.
 *
 * 고르는 규칙:
 * 1. 완료된 기록만 (진행 중인 것을 다시 보라고 하면 혼란스럽다)
 * 2. `REVISIT_MIN_DAYS` 이상 지난 것
 * 3. **아직 다시 보지 않은 것** — 이미 Revisit한 원본을 또 권하지 않는다
 * 4. 그중 가장 오래된 것 — 오래 묵을수록 지금의 나와 거리가 멀어 대조 가치가 크다
 */
export function suggestRevisitCandidate(
  sessions: readonly SessionSummary[],
  todayDateString: string,
): SessionSummary | null {
  const alreadyRevisited = new Set(
    sessions.map((s) => s.originSessionId).filter((id): id is string => Boolean(id)),
  );

  const candidates = sessions.filter(
    (s) =>
      s.status === "completed" &&
      !alreadyRevisited.has(s.id) &&
      daysBetween(s.trainingDate, todayDateString) >= REVISIT_MIN_DAYS,
  );
  if (candidates.length === 0) return null;

  return candidates.reduce((oldest, s) =>
    s.trainingDate.localeCompare(oldest.trainingDate) < 0 ? s : oldest,
  );
}

/** 며칠 지났는지 — 제안 문구에 쓴다("48일 전에 쓴 기록이에요"). */
export function daysSince(session: SessionSummary, todayDateString: string): number {
  return daysBetween(session.trainingDate, todayDateString);
}
