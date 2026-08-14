import { describe, expect, it } from "vitest";
import { applyStaleness, computeStaleArtifacts } from "@/domain/training/staleness";
import {
  makeAIFeedback,
  makeCoachInteraction,
  makeProblemDefinitionVersion,
  makeSnapshot,
} from "./fixtures";

describe("computeStaleArtifacts — coach_interactions (DEVELOPMENT_PLAN.md §7.4 table)", () => {
  it("editing observation stales separation-and-later coach interactions", () => {
    const snapshot = makeSnapshot({
      coachInteractions: [
        makeCoachInteraction({ id: "ci-obs", stage: "observation" }),
        makeCoachInteraction({ id: "ci-sep", stage: "separation" }),
        makeCoachInteraction({ id: "ci-feedback", stage: "feedback" }),
      ],
    });
    const result = computeStaleArtifacts("observation", snapshot);
    expect(result.staleCoachInteractionIds.sort()).toEqual(["ci-feedback", "ci-sep"]);
  });

  it("editing reframing stales only definition-and-later coach interactions", () => {
    const snapshot = makeSnapshot({
      coachInteractions: [
        makeCoachInteraction({ id: "ci-reframe", stage: "reframing" }),
        makeCoachInteraction({ id: "ci-def", stage: "definition" }),
        makeCoachInteraction({ id: "ci-feedback", stage: "feedback" }),
      ],
    });
    const result = computeStaleArtifacts("reframing", snapshot);
    expect(result.staleCoachInteractionIds.sort()).toEqual(["ci-def", "ci-feedback"]);
  });

  it("editing feedback (the last stage) stales nothing — there is no row after it", () => {
    const snapshot = makeSnapshot({
      coachInteractions: [makeCoachInteraction({ stage: "feedback" })],
    });
    const result = computeStaleArtifacts("feedback", snapshot);
    expect(result.staleCoachInteractionIds).toEqual([]);
    expect(result.staleAiFeedbackIds).toEqual([]);
  });

  it("does not re-flag already-stale coach interactions", () => {
    const snapshot = makeSnapshot({
      coachInteractions: [
        makeCoachInteraction({ id: "ci", stage: "feedback", isStale: true }),
      ],
    });
    const result = computeStaleArtifacts("observation", snapshot);
    expect(result.staleCoachInteractionIds).toEqual([]);
  });
});

describe("computeStaleArtifacts — ai_feedbacks", () => {
  it("editing any stage before definition stales all existing feedback", () => {
    const snapshot = makeSnapshot({
      aiFeedbacks: [makeAIFeedback({ id: "f1" }), makeAIFeedback({ id: "f2" })],
    });
    for (const stage of [
      "observation",
      "separation",
      "questioning",
      "exploration",
      "reframing",
    ] as const) {
      const result = computeStaleArtifacts(stage, snapshot);
      expect(result.staleAiFeedbackIds.sort()).toEqual(["f1", "f2"]);
    }
  });

  it("editing definition only stales feedback tied to an outdated version", () => {
    const v1 = makeProblemDefinitionVersion({ id: "pdv-1", versionNumber: 1 });
    const v2 = makeProblemDefinitionVersion({ id: "pdv-2", versionNumber: 2 });
    const snapshot = makeSnapshot({
      problemDefinitionVersions: [v1, v2],
      aiFeedbacks: [
        makeAIFeedback({ id: "f-old", problemDefinitionVersionId: v1.id }),
        makeAIFeedback({ id: "f-new", problemDefinitionVersionId: v2.id }),
      ],
    });
    const result = computeStaleArtifacts("definition", snapshot);
    expect(result.staleAiFeedbackIds).toEqual(["f-old"]);
  });

  it("editing definition with only one version present stales nothing (no newer version yet)", () => {
    const v1 = makeProblemDefinitionVersion({ id: "pdv-1", versionNumber: 1 });
    const snapshot = makeSnapshot({
      problemDefinitionVersions: [v1],
      aiFeedbacks: [makeAIFeedback({ problemDefinitionVersionId: v1.id })],
    });
    const result = computeStaleArtifacts("definition", snapshot);
    expect(result.staleAiFeedbackIds).toEqual([]);
  });
});

describe("applyStaleness", () => {
  it("flips isStale only for the computed ids, leaving everything else untouched", () => {
    const ci1 = makeCoachInteraction({ id: "ci-1", stage: "separation" });
    const ci2 = makeCoachInteraction({ id: "ci-2", stage: "observation" });
    const feedback = makeAIFeedback({ id: "f-1" });
    const snapshot = makeSnapshot({
      coachInteractions: [ci1, ci2],
      aiFeedbacks: [feedback],
    });

    const patch = applyStaleness(snapshot, {
      staleCoachInteractionIds: ["ci-1"],
      staleAiFeedbackIds: ["f-1"],
    });

    expect(patch.coachInteractions.find((c) => c.id === "ci-1")?.isStale).toBe(true);
    expect(patch.coachInteractions.find((c) => c.id === "ci-2")?.isStale).toBe(false);
    expect(patch.aiFeedbacks.find((f) => f.id === "f-1")?.isStale).toBe(true);
  });

  it("is pure — does not mutate the input snapshot's arrays", () => {
    const ci = makeCoachInteraction({ id: "ci-1", stage: "separation" });
    const snapshot = makeSnapshot({ coachInteractions: [ci] });
    applyStaleness(snapshot, {
      staleCoachInteractionIds: ["ci-1"],
      staleAiFeedbackIds: [],
    });
    expect(snapshot.coachInteractions[0]?.isStale).toBe(false);
  });

  it("preserves user text and prior versions — staleness is a flag, not a deletion", () => {
    const feedback = makeAIFeedback({ id: "f-1", nextQuestion: "원래 질문" });
    const snapshot = makeSnapshot({ aiFeedbacks: [feedback] });
    const patch = applyStaleness(snapshot, {
      staleCoachInteractionIds: [],
      staleAiFeedbackIds: ["f-1"],
    });
    expect(patch.aiFeedbacks[0]).toMatchObject({
      nextQuestion: "원래 질문",
      isStale: true,
    });
  });
});
