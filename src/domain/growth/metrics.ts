import type { SessionSummary } from "@/domain/types";

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

  // ── 품질 변화 지표 (P1-5) ────────────────────────────────────────────
  // 위 지표들은 전부 횟수·빈도라 "성실함"만 잰다. 아래는 "무엇이 달라졌나"를 잰다.
  /** 차원 충족도 추이. AI 판정이 있는 완료 세션만, 오래된 것 → 최근 것 순. */
  coverageTrend: QualityTrendPoint[];
  /** 초기 절반 → 최근 절반의 차원 충족도 변화. 비교할 표본이 부족하면 null. */
  coverageShift: TrendShift | null;
  /** 자기평가 ↔ AI 판정이 어긋난(과신) 차원 수 추이. 줄어들면 보정이 좋아진 것. */
  calibrationTrend: QualityTrendPoint[];
  /** 강한 힌트(Level 2) 의존도 변화. 줄어들면 스스로 해낸 것. */
  strongHintShift: TrendShift | null;
  /** AI를 한 번도 쓰지 않고 완주한 세션 수 (P1-6 전이 프로브). */
  completedWithoutAiCount: number;
}

/** 시간순 한 점. `value`의 의미는 지표마다 다르다(충족도는 비율, 보정은 개수). */
export interface QualityTrendPoint {
  sessionId: string;
  trainingDate: string;
  value: number;
}

/**
 * 초기 절반과 최근 절반의 평균 비교. 회귀선을 그리지 않는 이유는 표본이 수십 개
 * 규모라 기울기가 불안정하고, 사용자에게 보여줄 것은 "나아졌는지"라는 방향뿐이기
 * 때문이다. 점수가 아니라 **방향**만 남긴다(원칙 8 No hidden scoring).
 */
export interface TrendShift {
  earlier: number;
  recent: number;
  /** recent - earlier. 지표에 따라 증가가 좋을 수도, 감소가 좋을 수도 있다. */
  delta: number;
  sampleSize: number;
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
 * @param sessions 사용자의 세션 요약 목록(상태 무관 — 이 함수가 completed만 걸러낸다).
 *   전체 스냅샷이 아니라 `SessionSummary`를 받는다(그 타입의 주석 참고 — 목록 화면이
 *   스냅샷을 세션마다 만들면 N+1이 된다).
 * @param todayDateString 호출 시점의 사용자 로컬 날짜(YYYY-MM-DD). 서버는 요청의
 *   timezone으로, 클라이언트는 `Intl.DateTimeFormat`으로 구해 넘긴다.
 */
export function computeGrowthMetrics(
  sessions: SessionSummary[],
  todayDateString: string,
): GrowthMetrics {
  const completed = sessions.filter((s) => s.status === "completed");

  const thisWeekStart = mondayOf(todayDateString);
  const completedThisWeek = completed.filter(
    (s) => mondayOf(s.trainingDate) === thisWeekStart,
  ).length;

  const recentWeeks: WeeklyRhythmBucket[] = [3, 2, 1, 0].map((weeksAgo) => {
    const weekStart = addDays(thisWeekStart, -7 * weeksAgo);
    return {
      weekStart,
      completedCount: completed.filter((s) => mondayOf(s.trainingDate) === weekStart).length,
    };
  });

  const userAuthoredReframeCount = completed.reduce(
    (sum, s) => sum + s.userReframeCount,
    0,
  );

  const revisedDefinitionSessionCount = completed.filter(
    (s) => s.hasUserRevisedDefinition,
  ).length;

  // 품질 추이는 시간순(오래된 것 → 최근)이어야 "달라졌다"를 말할 수 있다.
  const chronological = [...completed].sort((a, b) =>
    a.trainingDate.localeCompare(b.trainingDate),
  );

  const coverageTrend: QualityTrendPoint[] = chronological
    .filter((s) => s.qualitySignals.assessedDimensions > 0)
    .map((s) => ({
      sessionId: s.id,
      trainingDate: s.trainingDate,
      value: s.qualitySignals.shownDimensions / s.qualitySignals.assessedDimensions,
    }));

  const calibrationTrend: QualityTrendPoint[] = chronological
    .filter((s) => s.qualitySignals.overconfidentDimensions !== null)
    .map((s) => ({
      sessionId: s.id,
      trainingDate: s.trainingDate,
      value: s.qualitySignals.overconfidentDimensions as number,
    }));

  const strongHintRatios = chronological
    .filter((s) => s.qualitySignals.hintCallCount > 0)
    .map((s) => s.qualitySignals.strongHintCount / s.qualitySignals.hintCallCount);

  return {
    completedThisWeek,
    recentWeeks,
    totalCompleted: completed.length,
    userAuthoredReframeCount,
    revisedDefinitionSessionCount,
    revisedDefinitionRatio:
      completed.length > 0 ? revisedDefinitionSessionCount / completed.length : 0,
    coverageTrend,
    coverageShift: computeShift(coverageTrend.map((p) => p.value)),
    calibrationTrend,
    strongHintShift: computeShift(strongHintRatios),
    completedWithoutAiCount: completed.filter((s) => s.qualitySignals.completedWithoutAi)
      .length,
  };
}

/** 비교에 최소한 이만큼은 있어야 "달라졌다"고 말한다 — 한두 개로 추세를 말하지 않는다. */
const MIN_SAMPLES_FOR_SHIFT = 4;

/**
 * 앞 절반 평균과 뒤 절반 평균을 비교한다. 홀수면 가운데 한 점은 어느 쪽에도 넣지
 * 않는다 — 표본이 적을 때 가운데 값이 양쪽에 모두 들어가면 차이가 과장된다.
 */
export function computeShift(values: readonly number[]): TrendShift | null {
  if (values.length < MIN_SAMPLES_FOR_SHIFT) return null;

  const half = Math.floor(values.length / 2);
  const earlierValues = values.slice(0, half);
  const recentValues = values.slice(values.length - half);

  const mean = (xs: readonly number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const earlier = mean(earlierValues);
  const recent = mean(recentValues);

  return { earlier, recent, delta: recent - earlier, sampleSize: values.length };
}
