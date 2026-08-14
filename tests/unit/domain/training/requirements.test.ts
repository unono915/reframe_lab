import { describe, expect, it } from "vitest";
import {
  checkStageRequirement,
  EXCEPTION_PROMPT_KEYS,
} from "@/domain/training/requirements";
import {
  makeAIFeedback,
  makeObservation,
  makeObservationItem,
  makeProblemDefinitionVersion,
  makeQuestion,
  makeReframe,
  makeSnapshot,
  makeStageResponse,
  passingExplorationResponses,
  passingQuestions,
  passingReframes,
} from "./fixtures";

describe("checkStageRequirement — not_started", () => {
  it("is always met (transition is a user action, not a data condition)", () => {
    expect(checkStageRequirement("not_started", makeSnapshot()).met).toBe(true);
  });
});

describe("checkStageRequirement — observation", () => {
  it("is not met with no observation", () => {
    const result = checkStageRequirement("observation", makeSnapshot());
    expect(result).toEqual({ met: false, viaException: false });
  });

  it("is not met with a blank observation", () => {
    const snapshot = makeSnapshot({ observation: makeObservation({ rawText: "   " }) });
    expect(checkStageRequirement("observation", snapshot).met).toBe(false);
  });

  it("is met normally with non-blank raw text", () => {
    const snapshot = makeSnapshot({
      observation: makeObservation({ rawText: "장면 하나" }),
    });
    expect(checkStageRequirement("observation", snapshot)).toEqual({
      met: true,
      viaException: false,
    });
  });

  it("is met via exception when the limit reason is recorded", () => {
    const snapshot = makeSnapshot({
      stageResponses: [
        makeStageResponse({
          stage: "observation",
          promptKey: EXCEPTION_PROMPT_KEYS.observation,
          content: "지금은 이 이상 구체화하기 어려워요",
        }),
      ],
    });
    expect(checkStageRequirement("observation", snapshot)).toEqual({
      met: true,
      viaException: true,
    });
  });

  it("ignores draft exception responses", () => {
    const snapshot = makeSnapshot({
      stageResponses: [
        makeStageResponse({
          stage: "observation",
          promptKey: EXCEPTION_PROMPT_KEYS.observation,
          content: "아직 제출 안 함",
          isDraft: true,
        }),
      ],
    });
    expect(checkStageRequirement("observation", snapshot).met).toBe(false);
  });
});

describe("checkStageRequirement — separation", () => {
  it("is not met with zero confirmed items", () => {
    const snapshot = makeSnapshot({
      observationItems: [makeObservationItem({ userConfirmed: false })],
    });
    expect(checkStageRequirement("separation", snapshot).met).toBe(false);
  });

  it("is met with at least one confirmed item", () => {
    const snapshot = makeSnapshot({
      observationItems: [
        makeObservationItem({ userConfirmed: false }),
        makeObservationItem({ userConfirmed: true }),
      ],
    });
    expect(checkStageRequirement("separation", snapshot)).toEqual({
      met: true,
      viaException: false,
    });
  });

  it("is met via exception when facts are recorded as insufficient", () => {
    const snapshot = makeSnapshot({
      stageResponses: [
        makeStageResponse({
          stage: "separation",
          promptKey: EXCEPTION_PROMPT_KEYS.separation,
          content: "확인된 사실이 부족해요",
        }),
      ],
    });
    expect(checkStageRequirement("separation", snapshot).viaException).toBe(true);
  });
});

describe("checkStageRequirement — questioning", () => {
  it("is not met with fewer than 3 user questions", () => {
    const snapshot = makeSnapshot({
      questions: [makeQuestion({ isPriority: true, priorityReason: "이유" })],
    });
    expect(checkStageRequirement("questioning", snapshot).met).toBe(false);
  });

  it("is not met with 3+ questions but no priority reason", () => {
    const snapshot = makeSnapshot({
      questions: passingQuestions().map((q) => ({
        ...q,
        isPriority: false,
        priorityReason: undefined,
      })),
    });
    expect(checkStageRequirement("questioning", snapshot).met).toBe(false);
  });

  it("is met normally with 3+ user questions and a justified priority", () => {
    const snapshot = makeSnapshot({ questions: passingQuestions() });
    expect(checkStageRequirement("questioning", snapshot)).toEqual({
      met: true,
      viaException: false,
    });
  });

  it("does not count AI-authored questions toward the user total", () => {
    const snapshot = makeSnapshot({
      questions: [
        ...passingQuestions().slice(0, 2),
        makeQuestion({ authorType: "ai", isPriority: true, priorityReason: "AI 제안" }),
      ],
    });
    expect(checkStageRequirement("questioning", snapshot).met).toBe(false);
  });

  it("is met via exception at hint level 2 with 1+ user question and an ack", () => {
    const snapshot = makeSnapshot({
      questions: [makeQuestion({ hintLevelUsed: 2 })],
      stageResponses: [
        makeStageResponse({
          stage: "questioning",
          promptKey: EXCEPTION_PROMPT_KEYS.questioning,
          content: "더 이상 질문이 안 떠올라요",
        }),
      ],
    });
    expect(checkStageRequirement("questioning", snapshot)).toEqual({
      met: true,
      viaException: true,
    });
  });

  it("rejects the exception path below hint level 2", () => {
    const snapshot = makeSnapshot({
      questions: [makeQuestion({ hintLevelUsed: 1 })],
      stageResponses: [
        makeStageResponse({
          stage: "questioning",
          promptKey: EXCEPTION_PROMPT_KEYS.questioning,
          content: "사유",
        }),
      ],
    });
    expect(checkStageRequirement("questioning", snapshot).met).toBe(false);
  });
});

describe("checkStageRequirement — exploration", () => {
  it("is not met when any of the 4 required prompts is missing", () => {
    const snapshot = makeSnapshot({
      stageResponses: passingExplorationResponses().slice(0, 3),
    });
    expect(checkStageRequirement("exploration", snapshot).met).toBe(false);
  });

  it("is met once all 4 prompts have an answer, including 'unknown'", () => {
    const snapshot = makeSnapshot({
      stageResponses: passingExplorationResponses(),
    });
    expect(checkStageRequirement("exploration", snapshot)).toEqual({
      met: true,
      viaException: false,
    });
  });

  it("accepts '모르겠다' as a valid answer for the unknown prompt", () => {
    const responses = passingExplorationResponses().map((r) =>
      r.promptKey === "unknown" ? { ...r, content: "모르겠다" } : r,
    );
    const snapshot = makeSnapshot({ stageResponses: responses });
    expect(checkStageRequirement("exploration", snapshot).met).toBe(true);
  });

  it("has no exception path — always false or true, never viaException", () => {
    const snapshot = makeSnapshot({ stageResponses: passingExplorationResponses() });
    expect(checkStageRequirement("exploration", snapshot).viaException).toBe(false);
  });
});

describe("checkStageRequirement — reframing", () => {
  it("is not met with fewer than 2 user reframes", () => {
    const snapshot = makeSnapshot({ reframes: [makeReframe()] });
    expect(checkStageRequirement("reframing", snapshot).met).toBe(false);
  });

  it("is met normally with 2+ user reframes", () => {
    const snapshot = makeSnapshot({ reframes: passingReframes() });
    expect(checkStageRequirement("reframing", snapshot)).toEqual({
      met: true,
      viaException: false,
    });
  });

  it("is met via exception with 1 reframe and a recorded reason", () => {
    const snapshot = makeSnapshot({
      reframes: [makeReframe()],
      stageResponses: [
        makeStageResponse({
          stage: "reframing",
          promptKey: EXCEPTION_PROMPT_KEYS.reframing,
          content: "막혔어요",
        }),
      ],
    });
    expect(checkStageRequirement("reframing", snapshot)).toEqual({
      met: true,
      viaException: true,
    });
  });
});

describe("checkStageRequirement — definition", () => {
  it("is not met with no v1", () => {
    expect(checkStageRequirement("definition", makeSnapshot()).met).toBe(false);
  });

  it("is met only by a user-authored v1 — no exception path exists", () => {
    const snapshot = makeSnapshot({
      problemDefinitionVersions: [
        makeProblemDefinitionVersion({ versionNumber: 1, authorType: "user" }),
      ],
    });
    expect(checkStageRequirement("definition", snapshot)).toEqual({
      met: true,
      viaException: false,
    });
  });

  it("rejects an AI-authored v1", () => {
    const snapshot = makeSnapshot({
      problemDefinitionVersions: [
        makeProblemDefinitionVersion({ versionNumber: 1, authorType: "ai" }),
      ],
    });
    expect(checkStageRequirement("definition", snapshot).met).toBe(false);
  });

  it("rejects v2 alone without a v1", () => {
    const snapshot = makeSnapshot({
      problemDefinitionVersions: [
        makeProblemDefinitionVersion({ versionNumber: 2, authorType: "user" }),
      ],
    });
    expect(checkStageRequirement("definition", snapshot).met).toBe(false);
  });
});

describe("checkStageRequirement — feedback", () => {
  it("is not met with neither fresh feedback nor a self-check", () => {
    expect(checkStageRequirement("feedback", makeSnapshot()).met).toBe(false);
  });

  it("is met normally when fresh AI feedback exists for the latest version", () => {
    const pdv = makeProblemDefinitionVersion({ id: "pdv-1", versionNumber: 1 });
    const snapshot = makeSnapshot({
      problemDefinitionVersions: [pdv],
      aiFeedbacks: [
        makeAIFeedback({ problemDefinitionVersionId: pdv.id, isStale: false }),
      ],
    });
    expect(checkStageRequirement("feedback", snapshot)).toEqual({
      met: true,
      viaException: false,
    });
  });

  it("ignores stale feedback tied to the latest version", () => {
    const pdv = makeProblemDefinitionVersion({ id: "pdv-1", versionNumber: 1 });
    const snapshot = makeSnapshot({
      problemDefinitionVersions: [pdv],
      aiFeedbacks: [
        makeAIFeedback({ problemDefinitionVersionId: pdv.id, isStale: true }),
      ],
    });
    expect(checkStageRequirement("feedback", snapshot).met).toBe(false);
  });

  it("is met via exception through the self-check checklist when AI has no fresh feedback", () => {
    const snapshot = makeSnapshot({
      stageResponses: [
        makeStageResponse({
          stage: "feedback",
          promptKey: "self_checklist_completed",
          content: "done",
        }),
      ],
    });
    expect(checkStageRequirement("feedback", snapshot)).toEqual({
      met: true,
      viaException: true,
    });
  });
});
