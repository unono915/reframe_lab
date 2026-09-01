import { describe, expect, it } from "vitest";
import { SELF_CHECK_ITEMS } from "@/domain/training/requirements";
import { feedbackDimensionKeySchema } from "@/lib/schemas/feedback-output";
import {
  AI_DIMENSION_KEY_BY_SELF_CHECK_KEY,
  compareSelfAssessmentWithAi,
  hasCompletedSelfAssessment,
  normalizeAiDimensionStatus,
  overconfidentDimensions,
  readSelfAssessment,
  selfAssessmentPromptKey,
  type SelfAssessmentStatus,
} from "@/domain/training/self-assessment";
import { makeAIFeedback, makeSnapshot, makeStageResponse } from "./fixtures";

/** 6개 차원에 모두 답한 StageResponse 배열. */
function answeredAll(status: SelfAssessmentStatus): ReturnType<typeof makeStageResponse>[] {
  return SELF_CHECK_ITEMS.map((item) =>
    makeStageResponse({
      id: `self-${item.key}`,
      stage: "feedback",
      promptKey: selfAssessmentPromptKey(item.key),
      content: status,
    }),
  );
}

/**
 * 이 테스트가 없었다면 대조 기능 전체가 조용히 죽은 채로 나갔다. 자기 점검 키는
 * snake_case, AI 차원 키는 camelCase라 `dimensions[selfCheckKey]`가 항상 undefined였고,
 * 화면에는 "어긋난 항목 없음"이 늘 정상처럼 보였을 것이다 — 실패가 눈에 띄지 않는
 * 종류의 버그다. 두 집합은 서로 다른 파일·다른 레이어에 있어 더 벌어지기 쉽다.
 */
describe("AI_DIMENSION_KEY_BY_SELF_CHECK_KEY", () => {
  it("6개 자기 점검 항목 전부에 대응하는 AI 차원 키가 있다", () => {
    for (const item of SELF_CHECK_ITEMS) {
      expect(AI_DIMENSION_KEY_BY_SELF_CHECK_KEY[item.key]).toBeTruthy();
    }
  });

  it("매핑된 값이 AI Output Schema의 실제 차원 키 집합과 정확히 일치한다", () => {
    const aiKeys = new Set(feedbackDimensionKeySchema.options);
    const mapped = Object.values(AI_DIMENSION_KEY_BY_SELF_CHECK_KEY);

    for (const key of mapped) {
      expect(aiKeys.has(key as (typeof feedbackDimensionKeySchema.options)[number])).toBe(true);
    }
    // 양방향으로 검사한다 — AI 차원이 늘었는데 자기 점검이 안 따라가도 잡아야 한다.
    expect(new Set(mapped).size).toBe(aiKeys.size);
  });
});

describe("readSelfAssessment", () => {
  it("아직 아무것도 답하지 않았으면 빈 객체", () => {
    expect(readSelfAssessment(makeSnapshot())).toEqual({});
  });

  it("저장된 차원별 판단을 읽는다", () => {
    const snapshot = makeSnapshot({ stageResponses: answeredAll("shown") });
    const result = readSelfAssessment(snapshot);
    for (const item of SELF_CHECK_ITEMS) {
      expect(result[item.key]).toBe("shown");
    }
  });

  it("초안(isDraft)은 확정 판단으로 읽지 않는다", () => {
    const snapshot = makeSnapshot({
      stageResponses: [
        makeStageResponse({
          stage: "feedback",
          promptKey: selfAssessmentPromptKey("scope"),
          content: "shown",
          isDraft: true,
        }),
      ],
    });
    expect(readSelfAssessment(snapshot).scope).toBeUndefined();
  });

  it("알 수 없는 값이 저장돼 있으면 무시한다", () => {
    // DB에 예전 형식("confirmed" 등)이 남아 있어도 대조표가 깨지지 않아야 한다.
    const snapshot = makeSnapshot({
      stageResponses: [
        makeStageResponse({
          stage: "feedback",
          promptKey: selfAssessmentPromptKey("scope"),
          content: "confirmed",
        }),
      ],
    });
    expect(readSelfAssessment(snapshot).scope).toBeUndefined();
  });
});

describe("hasCompletedSelfAssessment", () => {
  it("6개를 모두 답해야 true", () => {
    expect(hasCompletedSelfAssessment(makeSnapshot({ stageResponses: answeredAll("shown") }))).toBe(
      true,
    );
  });

  it("하나라도 빠지면 false — 일부만 답한 채 AI와 대조하지 않는다", () => {
    const partial = answeredAll("shown").slice(0, SELF_CHECK_ITEMS.length - 1);
    expect(hasCompletedSelfAssessment(makeSnapshot({ stageResponses: partial }))).toBe(false);
  });
});

describe("normalizeAiDimensionStatus", () => {
  it("explore_further와 unverified는 사용자 관점에서 모두 '아직'이다", () => {
    expect(normalizeAiDimensionStatus("shown")).toBe("shown");
    expect(normalizeAiDimensionStatus("explore_further")).toBe("not_yet");
    expect(normalizeAiDimensionStatus("unverified")).toBe("not_yet");
  });
});

describe("compareSelfAssessmentWithAi", () => {
  it("자기평가가 없으면 대조표도 비어 있다 — 사용자가 먼저 판단해야 의미가 있다", () => {
    const snapshot = makeSnapshot();
    expect(compareSelfAssessmentWithAi(snapshot, makeAIFeedback())).toEqual([]);
  });

  it("AI 피드백이 없으면 ai는 null이고 어긋남으로 세지 않는다", () => {
    const snapshot = makeSnapshot({ stageResponses: answeredAll("shown") });
    const result = compareSelfAssessmentWithAi(snapshot, null);

    expect(result).toHaveLength(SELF_CHECK_ITEMS.length);
    for (const comparison of result) {
      expect(comparison.ai).toBeNull();
      expect(comparison.mismatch).toBe(false);
    }
  });

  it("판단이 어긋난 차원만 mismatch로 표시한다", () => {
    const snapshot = makeSnapshot({ stageResponses: answeredAll("shown") });
    const feedback = makeAIFeedback({
      dimensions: {
        // AI 쪽 키(camelCase)로 저장된다 — 자기 점검 키와 이름 체계가 다르다.
        perspectiveAndScope: { status: "unverified", evidence: "범위가 드러나지 않음" },
        evidence: { status: "shown", evidence: "구체적 시간이 적힘" },
      },
    });

    const result = compareSelfAssessmentWithAi(snapshot, feedback);
    const scope = result.find((c) => c.key === "scope");
    const observationEvidence = result.find((c) => c.key === "observation_evidence");

    expect(scope?.mismatch).toBe(true);
    expect(scope?.ai).toBe("not_yet");
    expect(observationEvidence?.mismatch).toBe(false);
    expect(observationEvidence?.ai).toBe("shown");
  });

  it("AI가 판정하지 않은 차원은 자기평가만 남고 어긋남이 아니다", () => {
    const snapshot = makeSnapshot({ stageResponses: answeredAll("not_yet") });
    const result = compareSelfAssessmentWithAi(snapshot, makeAIFeedback({ dimensions: {} }));

    expect(result).toHaveLength(SELF_CHECK_ITEMS.length);
    expect(result.every((c) => c.ai === null && !c.mismatch)).toBe(true);
  });
});

describe("overconfidentDimensions", () => {
  /**
   * 이 함수가 존재하는 이유가 여기에 있다 — 두 방향의 어긋남 중 사용자가 다음에
   * 볼 곳은 "스스로는 드러났다고 봤지만 근거가 없는" 쪽뿐이다. 반대 방향은
   * 경고할 일이 아니라 오히려 안심시킬 정보라 제외한다.
   */
  it("과신한 방향만 남기고 과소평가한 방향은 제외한다", () => {
    const snapshot = makeSnapshot({
      stageResponses: [
        makeStageResponse({
          stage: "feedback",
          promptKey: selfAssessmentPromptKey("scope"),
          content: "shown",
        }),
        makeStageResponse({
          stage: "feedback",
          promptKey: selfAssessmentPromptKey("observation_evidence"),
          content: "not_yet",
        }),
      ],
    });
    const feedback = makeAIFeedback({
      dimensions: {
        // 사용자는 드러났다고 봤지만 AI는 아니라고 본 경우 → 짚어준다
        perspectiveAndScope: { status: "unverified", evidence: "" },
        // 사용자는 아직이라 봤지만 AI는 드러났다고 본 경우 → 짚지 않는다
        evidence: { status: "shown", evidence: "" },
      },
    });

    const result = overconfidentDimensions(compareSelfAssessmentWithAi(snapshot, feedback));

    expect(result.map((c) => c.key)).toEqual(["scope"]);
  });
});
