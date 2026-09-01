import type { AIFeedback, TrainingSessionSnapshot } from "@/domain/types";
import { SELF_CHECK_ITEMS, type SelfCheckKey } from "./requirements";

/**
 * 자기 점검(self-assessment)과 AI 판정의 대조 (RESEARCH_VALIDATION.md §5 P0-2).
 *
 * 왜 필요한가 — `SELF_CHECK_ITEMS`(PRD §7.8의 6개 평가 차원)는 원래 **AI가 실패했을
 * 때만** 등장하는 대체 경로였다. 루브릭 메타분석은 정반대를 말한다: 루브릭의 학습
 * 효과는 **자기평가 목적으로 쓸 때 가장 크고**, 그 기제는 기준의 투명성이다.
 * 그래서 이 6문항을 매 세션의 정규 단계로 올리고, AI 피드백보다 **먼저** 답하게 한다.
 *
 * 더 중요한 것은 그다음이다. AI는 이미 같은 6개 차원에 대해 판정을 생성해
 * `ai_feedbacks.dimensions`에 저장하고 있었지만 화면에서 쓰이지 않았다. 자기평가와
 * AI 판정의 **어긋남(mismatch) 자체가 메타인지 보정 신호**다 — "스스로는 드러났다고
 * 봤는데 근거를 찾지 못한 항목"이 사용자가 다음에 볼 곳이다.
 *
 * 이것은 점수가 아니다. 원칙 8(No hidden scoring)이 금지한 것은 **설명할 수 없는
 * 총점**이지 설명 가능한 차원별 기준이 아니다 — 여기서는 합산하지 않는다.
 */

/** 사용자 자기평가는 2지선다다. AI의 3단계보다 가볍게 유지한다 — 모바일 5~10분 세션. */
export type SelfAssessmentStatus = "shown" | "not_yet";

/**
 * 자기평가는 별도 테이블 없이 `StageResponse`에 예약 promptKey로 저장한다 —
 * `EXCEPTION_PROMPT_KEYS`·`FEEDBACK_SELF_CHECK_PROMPT_KEY`가 이미 쓰는 방식이고,
 * 차원별로 한 행씩 남겨야 나중에 보정 추이(P1-5 지표)를 단순 필터로 계산할 수 있다.
 */
export const SELF_ASSESSMENT_PROMPT_PREFIX = "self_check_";

export function selfAssessmentPromptKey(key: SelfCheckKey): string {
  return `${SELF_ASSESSMENT_PROMPT_PREFIX}${key}`;
}

/**
 * 자기 점검 키 → AI 차원 키 매핑. **같은 6개 차원(PRD §7.8)인데 이름 체계가 다르다** —
 * `SELF_CHECK_ITEMS`는 snake_case(`observation_evidence`), AI Output Schema는
 * camelCase(`evidence`)를 쓴다. 두 집합이 각각 다른 문서 절을 옮겨오면서 갈라졌다.
 *
 * 이 맵 없이 `dimensions[selfCheckKey]`로 바로 조회하면 **항상 undefined가 되어
 * 대조가 영원히 성립하지 않는다**(테스트로 실제로 잡았다). 이름을 한쪽으로 통일하는
 * 것이 더 깨끗하지만, AI 차원 키는 이미 `ai_feedbacks.dimensions` JSON으로 실제
 * 사용자 데이터에 저장돼 있어 함부로 바꾸면 과거 기록의 대조가 깨진다.
 * 그래서 이름은 그대로 두고 경계에 매핑을 둔다.
 *
 * `lib/schemas/feedback-output.ts`의 `feedbackDimensionKeySchema`가 AI 쪽 정본이지만
 * domain은 `@/lib/*`를 import할 수 없다(레이어 규칙). 두 집합이 어긋나면 곧바로
 * 실패하도록 `self-assessment.test.ts`가 양쪽을 함께 검사한다.
 */
export const AI_DIMENSION_KEY_BY_SELF_CHECK_KEY: Record<SelfCheckKey, string> = {
  observation_evidence: "evidence",
  user_context: "userAndContext",
  goal_barrier_impact: "goalBarrierImpact",
  fact_vs_hypothesis: "factVsHypothesis",
  scope: "perspectiveAndScope",
  next_exploration: "furtherInquiry",
};

export interface DimensionComparison {
  key: SelfCheckKey;
  label: string;
  self: SelfAssessmentStatus;
  /** AI가 이 차원을 판정하지 않았으면 null — 6개를 항상 다 채우도록 강제하지 않는다. */
  ai: SelfAssessmentStatus | null;
  /** 둘 다 있고 서로 다를 때만 true. AI 판정이 없으면 어긋남으로 세지 않는다. */
  mismatch: boolean;
}

/**
 * AI의 3단계(`shown`/`explore_further`/`unverified`)를 사용자의 2지선다로 접는다.
 * `explore_further`(더 살펴볼 필요)와 `unverified`(확인 안 됨)는 사용자 입장에서
 * 모두 "아직 드러나지 않음"이다 — 이 구분은 AI 피드백 본문이 이미 설명한다.
 */
export function normalizeAiDimensionStatus(
  status: "shown" | "explore_further" | "unverified",
): SelfAssessmentStatus {
  return status === "shown" ? "shown" : "not_yet";
}

/** 스냅샷에 저장된 사용자 자기평가를 읽는다. 아직 답하지 않은 차원은 키가 없다. */
export function readSelfAssessment(
  snapshot: TrainingSessionSnapshot,
): Partial<Record<SelfCheckKey, SelfAssessmentStatus>> {
  const result: Partial<Record<SelfCheckKey, SelfAssessmentStatus>> = {};

  for (const item of SELF_CHECK_ITEMS) {
    const response = snapshot.stageResponses.find(
      (r) =>
        r.stage === "feedback" &&
        r.promptKey === selfAssessmentPromptKey(item.key) &&
        !r.isDraft,
    );
    if (response?.content === "shown" || response?.content === "not_yet") {
      result[item.key] = response.content;
    }
  }

  return result;
}

/** 6개 차원에 모두 답했는가. AI 피드백 요청을 여는 조건이다(사용자가 먼저 판단한다). */
export function hasCompletedSelfAssessment(snapshot: TrainingSessionSnapshot): boolean {
  const assessment = readSelfAssessment(snapshot);
  return SELF_CHECK_ITEMS.every((item) => assessment[item.key] !== undefined);
}

/**
 * 자기평가 ↔ AI 판정 대조표. 자기평가가 없는 차원은 결과에서 빠진다 —
 * 대조는 사용자가 먼저 판단했을 때만 의미가 있다.
 */
export function compareSelfAssessmentWithAi(
  snapshot: TrainingSessionSnapshot,
  feedback: AIFeedback | null,
): DimensionComparison[] {
  const assessment = readSelfAssessment(snapshot);

  return SELF_CHECK_ITEMS.flatMap((item) => {
    const self = assessment[item.key];
    if (self === undefined) return [];

    const aiDimension = feedback?.dimensions[AI_DIMENSION_KEY_BY_SELF_CHECK_KEY[item.key]];
    const ai = aiDimension ? normalizeAiDimensionStatus(aiDimension.status) : null;

    return [
      {
        key: item.key,
        label: item.label,
        self,
        ai,
        mismatch: ai !== null && ai !== self,
      },
    ];
  });
}

/**
 * 사용자가 다음에 볼 곳: 스스로는 드러났다고 봤지만 AI가 근거를 찾지 못한 차원.
 * 반대 방향(사용자는 아직이라 봤는데 AI는 드러났다고 본 경우)은 경고할 일이 아니라
 * 오히려 안심시킬 정보라 여기 넣지 않는다.
 */
export function overconfidentDimensions(
  comparisons: DimensionComparison[],
): DimensionComparison[] {
  return comparisons.filter((c) => c.mismatch && c.self === "shown");
}
