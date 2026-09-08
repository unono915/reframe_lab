import { describe, expect, it } from "vitest";
import {
  exceptionReasonInputSchema,
  explorationResponseInputSchema,
  observationInputSchema,
  observationItemInputSchema,
  perspectiveInputSchema,
  priorityQuestionInputSchema,
  problemDefinitionInputSchema,
  questionInputSchema,
  reframeInputSchema,
  stageResponseInputSchema,
} from "@/lib/schemas/stage-input";

describe("observationInputSchema", () => {
  it("accepts a plain observation", () => {
    expect(
      observationInputSchema.safeParse({ rawText: "회의에 매번 늦는 사람이 있다" })
        .success,
    ).toBe(true);
  });

  it("rejects an empty rawText — this is the shape check, not the exception path", () => {
    const result = observationInputSchema.safeParse({ rawText: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only rawText", () => {
    expect(observationInputSchema.safeParse({ rawText: "   " }).success).toBe(false);
  });

  it("rejects an over-length rawText", () => {
    expect(observationInputSchema.safeParse({ rawText: "a".repeat(2001) }).success).toBe(
      false,
    );
  });
});

describe("observationItemInputSchema", () => {
  it("accepts all 5 item types", () => {
    for (const type of ["fact", "interpretation", "assumption", "emotion", "solution"]) {
      expect(observationItemInputSchema.safeParse({ text: "x", type }).success).toBe(
        true,
      );
    }
  });

  it("rejects an unknown type", () => {
    expect(
      observationItemInputSchema.safeParse({ text: "x", type: "opinion" }).success,
    ).toBe(false);
  });
});

describe("questionInputSchema / priorityQuestionInputSchema", () => {
  it("allows a question without a lens", () => {
    expect(questionInputSchema.safeParse({ text: "왜 그랬을까?" }).success).toBe(true);
  });

  it("requires a priority reason, matching PRD §12.2 questioning exit condition", () => {
    expect(
      priorityQuestionInputSchema.safeParse({ questionId: "q-1", priorityReason: "" })
        .success,
    ).toBe(false);
    expect(
      priorityQuestionInputSchema.safeParse({
        questionId: "q-1",
        priorityReason: "가장 중요함",
      }).success,
    ).toBe(true);
  });
});

describe("perspectiveInputSchema / reframeInputSchema", () => {
  it("requires a known perspective lens", () => {
    expect(
      perspectiveInputSchema.safeParse({ lensType: "stakeholder", content: "x" }).success,
    ).toBe(true);
    expect(
      perspectiveInputSchema.safeParse({ lensType: "made_up", content: "x" }).success,
    ).toBe(false);
  });

  it("allows a reframe without a lens (lens is optional for a free-form reframe)", () => {
    expect(reframeInputSchema.safeParse({ text: "다른 프레임" }).success).toBe(true);
  });
});

describe("problemDefinitionInputSchema", () => {
  it("accepts a definition with an optional change reason", () => {
    expect(
      problemDefinitionInputSchema.safeParse({
        text: "정의",
        changeReason: "새 근거 발견",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty definition text", () => {
    expect(problemDefinitionInputSchema.safeParse({ text: "" }).success).toBe(false);
  });
});

describe("stageResponseInputSchema / explorationResponseInputSchema", () => {
  it("the generic schema accepts any non-empty promptKey — used for exception reasons too", () => {
    expect(
      stageResponseInputSchema.safeParse({
        promptKey: "observation_limit_reason",
        content: "지금은 더 구체화하기 어려워요",
      }).success,
    ).toBe(true);
  });

  it("the exploration-specific schema only accepts the 4 required prompt keys", () => {
    for (const promptKey of ["affected_user", "context", "impact", "unknown"]) {
      expect(
        explorationResponseInputSchema.safeParse({ promptKey, content: "x" }).success,
      ).toBe(true);
    }
    expect(
      explorationResponseInputSchema.safeParse({
        promptKey: "something_else",
        content: "x",
      }).success,
    ).toBe(false);
  });

  it("accepts '모르겠다' as valid content — the schema only checks non-empty, not meaning", () => {
    expect(
      explorationResponseInputSchema.safeParse({
        promptKey: "unknown",
        content: "모르겠다",
      }).success,
    ).toBe(true);
  });
});

/**
 * 예외 사유 경로로 **예약 표식**을 쓸 수 없어야 한다.
 *
 * 이 앱은 `stage_responses`의 promptKey를 표식으로도 쓴다 — "오늘은 혼자 해보기"
 * (`solo_mode`), 자기 점검 답변(`self_check_*`), 자기 점검 완료
 * (`self_checklist_completed`). 예외 사유 저장이 아무 promptKey나 받아주면 요청
 * 하나로 세션에 없던 표식이 생기고, 전이 프로브의 전제("사용자의 명시적 선택이
 * 있어야만 센다")가 무너진다. 그러면 Growth의 "혼자 해낸 기록"은 예전에 한 번
 * 그랬던 것처럼 다시 허위 신호가 된다.
 *
 * 클라이언트 타입은 이미 좁혀져 있지만 그건 클라이언트의 약속일 뿐이다 — 서버는
 * 클라이언트가 보낸 값을 신뢰하지 않는다(원칙 6).
 */
describe("exceptionReasonInputSchema", () => {
  it("네 단계의 예외 사유 키만 받는다", () => {
    for (const promptKey of [
      "observation_limit_reason",
      "insufficient_facts_reason",
      "questioning_exception_reason",
      "reframe_exception_reason",
    ]) {
      expect(
        exceptionReasonInputSchema.safeParse({ promptKey, content: "이유" }).success,
        promptKey,
      ).toBe(true);
    }
  });

  it("예약 표식은 거부한다", () => {
    for (const promptKey of [
      "solo_mode",
      "self_checklist_completed",
      "self_check_scope",
      "affected_user",
      "아무거나",
    ]) {
      expect(
        exceptionReasonInputSchema.safeParse({ promptKey, content: "이유" }).success,
        promptKey,
      ).toBe(false);
    }
  });

  it("내용 규칙은 예전과 같다", () => {
    expect(
      exceptionReasonInputSchema.safeParse({
        promptKey: "observation_limit_reason",
        content: "   ",
      }).success,
    ).toBe(false);
  });
});
