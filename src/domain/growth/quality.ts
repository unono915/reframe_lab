import type {
  AIFeedbackDimension,
  HintLevel,
  SessionQualitySignals,
} from "@/domain/types";
import { SELF_CHECK_ITEMS, type SelfCheckKey } from "@/domain/training/requirements";
import {
  AI_DIMENSION_KEY_BY_SELF_CHECK_KEY,
  normalizeAiDimensionStatus,
  type SelfAssessmentStatus,
} from "@/domain/training/self-assessment";

/**
 * 세션 하나에서 뽑아내는 **품질 신호** (RESEARCH_VALIDATION.md §5 P1-5).
 *
 * 왜 필요한가 — 기존 `metrics.ts`의 6개 지표는 전부 횟수·빈도였다(완료 수, 재정의
 * 개수, 수정 비율…). PRD §2.4는 스스로 이렇게 적어놓았다:
 *
 * > "단순 훈련 개수, 글자 수, AI 호출 횟수는 사고 능력 향상의 직접 지표로 사용하지 않는다."
 *
 * 그런데 `userAuthoredReframeCount`는 정확히 그 금지에 해당했다. 성실하게 프레임 2개를
 * 채우기만 해도 모든 지표가 우상향해서, **성실함이 향상으로 오인돼 보일 수 있었다.**
 *
 * 여기서 뽑는 세 신호는 전부 "얼마나 많이 했나"가 아니라 "무엇이 달라졌나"를 잰다.
 * 1. **차원 충족도** — 내 정의에 6개 차원 중 몇 개가 실제로 드러났는가(AI 판정)
 * 2. **과신 차원 수** — 스스로 드러났다고 본 것 중 근거가 없던 것(메타인지 보정)
 * 3. **힌트 의존도** — 가장 강한 힌트를 얼마나 자주 썼는가(scaffolding fading)
 *
 * 그리고 P1-6의 **AI 없이 완주**까지. 셋 다 새 저장소가 필요 없다 — 이미 쌓이고 있던
 * 데이터를 처음으로 읽는 것뿐이다.
 */
export interface QualitySignalInput {
  /** 최신 정의 버전에 대한 AI 피드백의 차원 판정. 없으면 null. */
  dimensions: Record<string, AIFeedbackDimension> | null;
  /** 사용자 자기평가. 아직 답하지 않은 차원은 키가 없다. */
  selfAssessment: Partial<Record<SelfCheckKey, SelfAssessmentStatus>>;
  /** 이 세션에서 발생한 코칭 호출들의 힌트 레벨. */
  hintLevels: readonly HintLevel[];
  /** 세션에 기록된 총 AI 호출 수(힌트 + 피드백). */
  aiCallCount: number;
  /**
   * 사용자가 "오늘은 혼자 해보기"를 **선택했는가**. 우연히 AI를 안 쓴 것과
   * 구분해야 전이 프로브가 의미를 갖는다 — 제공자가 연결되기 전의 과거 기록도
   * `aiCallCount === 0`이라, 이 표식 없이 세면 "혼자 해낸 기록"이 부풀려진다.
   */
  soloMode: boolean;
}

export function deriveQualitySignals(input: QualitySignalInput): SessionQualitySignals {
  let assessedDimensions = 0;
  let shownDimensions = 0;
  let overconfident = 0;
  let comparableDimensions = 0;

  for (const item of SELF_CHECK_ITEMS) {
    const aiDimension = input.dimensions?.[AI_DIMENSION_KEY_BY_SELF_CHECK_KEY[item.key]];
    if (!aiDimension) continue;

    assessedDimensions += 1;
    const ai = normalizeAiDimensionStatus(aiDimension.status);
    if (ai === "shown") shownDimensions += 1;

    const self = input.selfAssessment[item.key];
    if (self === undefined) continue;
    comparableDimensions += 1;
    if (self === "shown" && ai !== "shown") overconfident += 1;
  }

  return {
    assessedDimensions,
    shownDimensions,
    overconfidentDimensions: comparableDimensions > 0 ? overconfident : null,
    hintCallCount: input.hintLevels.length,
    strongHintCount: input.hintLevels.filter((level) => level === 2).length,
    completedWithoutAi: input.soloMode && input.aiCallCount === 0,
  };
}

/** 아직 아무 신호도 없는 세션(진행 중이거나 피드백 전)의 기본값. */
export const EMPTY_QUALITY_SIGNALS: SessionQualitySignals = {
  assessedDimensions: 0,
  shownDimensions: 0,
  overconfidentDimensions: null,
  hintCallCount: 0,
  strongHintCount: 0,
  completedWithoutAi: false,
};
