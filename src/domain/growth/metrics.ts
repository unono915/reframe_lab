import type { TrainingSessionSnapshot } from "@/domain/types";

/**
 * DESIGN.md §10.7 S-07 Growth — 점수화 대신 꾸준함·재정의·수정 행동을 보여준다.
 * 완료(`completed`)되지 않은 세션은 절대 포함하지 않는다(미완료·포기가 완료
 * 횟수에 포함되지 않아야 한다는 완료 조건). 순수 함수라 저장된 세션 목록만
 * 있으면 언제든 재계산할 수 있다 — 별도 Growth Snapshot을 만들지 않는 이유다.
 */

export interface WeeklyRhythmBucket {
  /** 그 주의 월요일(YYYY-MM-DD). */
  weekStart: string;
  completedCount: number;
}

export interface GrowthMetrics {
  completedThisWeek: number;
  /** 최근 4주, 오래된 주 → 이번 주 순서. 항상 4개(기록이 없는 주도 0으로 포함). */
  recentWeeks: WeeklyRhythmBucket[];
  totalCompleted: number;
  /** 재정의(reframing) 단계에서 사용자가 직접 작성한 대안 프레임 총 개수. */
  userAuthoredReframeCount: number;
  /** v1 이후 사용자가 직접 수정한(v2+) 정의가 있는 완료 세션 수. */
  revisedDefinitionSessionCount: number;
  /** completedTotal이 0이면 0. */
  revisedDefinitionRatio: number;
}

/** trainingDate(YYYY-MM-DD)가 속한 주의 월요일을 YYYY-MM-DD로 반환한다. */
function mondayOf(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  const day = date.getUTCDay();
  const diffFromMonday = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - diffFromMonday);
  return date.toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * @param sessions 사용자의 세션 스냅샷 목록(상태 무관 — 이 함수가 completed만 걸러낸다).
 * @param todayDateString 호출 시점의 사용자 로컬 날짜(YYYY-MM-DD). 서버는 요청의
 *   timezone으로, 클라이언트는 `Intl.DateTimeFormat`으로 구해 넘긴다.
 */
export function computeGrowthMetrics(
  sessions: TrainingSessionSnapshot[],
  todayDateString: string,
): GrowthMetrics {
  const completed = sessions.filter((s) => s.session.status === "completed");

  const thisWeekStart = mondayOf(todayDateString);
  const completedThisWeek = completed.filter(
    (s) => mondayOf(s.session.trainingDate) === thisWeekStart,
  ).length;

  const recentWeeks: WeeklyRhythmBucket[] = [3, 2, 1, 0].map((weeksAgo) => {
    const weekStart = addDays(thisWeekStart, -7 * weeksAgo);
    return {
      weekStart,
      completedCount: completed.filter((s) => mondayOf(s.session.trainingDate) === weekStart)
        .length,
    };
  });

  const userAuthoredReframeCount = completed.reduce(
    (sum, s) => sum + s.reframes.filter((r) => r.authorType === "user").length,
    0,
  );

  const revisedDefinitionSessionCount = completed.filter((s) =>
    s.problemDefinitionVersions.some((v) => v.versionNumber > 1 && v.authorType === "user"),
  ).length;

  return {
    completedThisWeek,
    recentWeeks,
    totalCompleted: completed.length,
    userAuthoredReframeCount,
    revisedDefinitionSessionCount,
    revisedDefinitionRatio:
      completed.length > 0 ? revisedDefinitionSessionCount / completed.length : 0,
  };
}
