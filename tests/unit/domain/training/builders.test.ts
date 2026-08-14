import { describe, expect, it } from "vitest";
import {
  buildObservation,
  buildObservationItem,
  buildProblemDefinitionVersion,
  buildQuestion,
  buildReframe,
  buildStageResponse,
} from "@/domain/training/builders";
import { makeProblemDefinitionVersion } from "./fixtures";

describe("buildObservation", () => {
  it("creates a new id and version 1 when there is no existing observation", () => {
    const obs = buildObservation("session-1", { rawText: "장면" }, null);
    expect(obs.id).toBeTruthy();
    expect(obs.version).toBe(1);
    expect(obs.rawText).toBe("장면");
  });

  it("keeps the same id and bumps version when editing an existing observation", () => {
    const first = buildObservation("session-1", { rawText: "장면" }, null);
    const edited = buildObservation("session-1", { rawText: "고친 장면" }, first);
    expect(edited.id).toBe(first.id);
    expect(edited.version).toBe(2);
    expect(edited.createdAt).toBe(first.createdAt);
  });
});

describe("buildObservationItem / buildQuestion / buildReframe", () => {
  it("defaults authorType to user and confirms user-authored items automatically", () => {
    const item = buildObservationItem("obs-1", { text: "사실", type: "fact" }, 0);
    expect(item.authorType).toBe("user");
    expect(item.userConfirmed).toBe(true);
  });

  it("does not auto-confirm AI-authored items", () => {
    const item = buildObservationItem(
      "obs-1",
      { text: "제안", type: "assumption" },
      0,
      "ai",
    );
    expect(item.userConfirmed).toBe(false);
  });

  it("builds a question with isPriority false and hintLevelUsed 0 by default", () => {
    const q = buildQuestion("session-1", { text: "왜?" }, 0);
    expect(q.isPriority).toBe(false);
    expect(q.hintLevelUsed).toBe(0);
  });

  it("builds a reframe carrying the given order", () => {
    const r = buildReframe("session-1", { text: "다른 프레임" }, 2);
    expect(r.order).toBe(2);
  });
});

describe("buildProblemDefinitionVersion", () => {
  it("starts at version 1 when there are no existing versions", () => {
    const v = buildProblemDefinitionVersion("session-1", { text: "정의" }, []);
    expect(v.versionNumber).toBe(1);
  });

  it("increments past the highest existing version number", () => {
    const existing = [
      makeProblemDefinitionVersion({ versionNumber: 1 }),
      makeProblemDefinitionVersion({ versionNumber: 2 }),
    ];
    const v = buildProblemDefinitionVersion("session-1", { text: "v3" }, existing);
    expect(v.versionNumber).toBe(3);
  });
});

describe("buildStageResponse", () => {
  it("is never a draft and never stale when freshly built", () => {
    const r = buildStageResponse("session-1", "exploration", {
      promptKey: "context",
      content: "x",
    });
    expect(r.isDraft).toBe(false);
    expect(r.isStale).toBe(false);
  });
});
