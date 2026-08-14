import { describe, expect, it } from "vitest";
import { isSessionComplete, summarizeCompletion } from "@/domain/training/completion";
import { EXCEPTION_PROMPT_KEYS } from "@/domain/training/requirements";
import {
  makeObservation,
  makeQuestion,
  makeReframe,
  makeSession,
  makeSnapshot,
  makeStageResponse,
  passingExplorationResponses,
  passingReframes,
} from "./fixtures";

describe("isSessionComplete", () => {
  it("is false for any non-completed status", () => {
    expect(
      isSessionComplete(makeSnapshot({ session: makeSession({ status: "feedback" }) })),
    ).toBe(false);
  });

  it("is true only when status is completed", () => {
    expect(
      isSessionComplete(makeSnapshot({ session: makeSession({ status: "completed" }) })),
    ).toBe(true);
  });
});

describe("summarizeCompletion", () => {
  it("reports no exceptions when every stage passes normally", () => {
    const snapshot = makeSnapshot({
      session: makeSession({ status: "completed" }),
      observation: makeObservation(),
      questions: [
        makeQuestion({ isPriority: true, priorityReason: "이유" }),
        makeQuestion(),
        makeQuestion(),
      ],
      stageResponses: passingExplorationResponses(),
      reframes: passingReframes(),
    });
    const summary = summarizeCompletion(snapshot);
    expect(summary.completed).toBe(true);
    // separation, definition, feedback은 이 픽스처에 데이터가 없어 met=false이므로
    // exception 목록에도 잡히지 않는다 — viaException은 "예외로 met"일 때만 기록된다.
    expect(summary.stagesPassedByException).not.toContain("observation");
    expect(summary.stagesPassedByException).not.toContain("questioning");
    expect(summary.stagesPassedByException).not.toContain("exploration");
    expect(summary.stagesPassedByException).not.toContain("reframing");
  });

  it("lists every stage that passed via its exception path", () => {
    const snapshot = makeSnapshot({
      stageResponses: [
        makeStageResponse({
          stage: "observation",
          promptKey: EXCEPTION_PROMPT_KEYS.observation,
          content: "사유",
        }),
        makeStageResponse({
          stage: "separation",
          promptKey: EXCEPTION_PROMPT_KEYS.separation,
          content: "사유",
        }),
      ],
    });
    const summary = summarizeCompletion(snapshot);
    expect(summary.stagesPassedByException).toEqual(
      expect.arrayContaining(["observation", "separation"]),
    );
  });

  it("does not falsely list reframing as exception when it passed normally", () => {
    const snapshot = makeSnapshot({ reframes: passingReframes() });
    const summary = summarizeCompletion(snapshot);
    expect(summary.stagesPassedByException).not.toContain("reframing");
  });

  it("does list reframing as exception when only 1 reframe + reason is present", () => {
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
    const summary = summarizeCompletion(snapshot);
    expect(summary.stagesPassedByException).toContain("reframing");
  });
});
