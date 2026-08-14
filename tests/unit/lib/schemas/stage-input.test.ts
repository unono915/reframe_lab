import { describe, expect, it } from "vitest";
import {
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
