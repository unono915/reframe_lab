import { describe, expect, it } from "vitest";
import {
  abandonSession,
  advanceStage,
  canAdvance,
  pauseSession,
  resumeSession,
} from "@/domain/training/state-machine";
import {
  makeObservation,
  makeProblemDefinitionVersion,
  makeReframe,
  makeSession,
  makeSnapshot,
  passingExplorationResponses,
  passingQuestions,
  passingReframes,
} from "./fixtures";

describe("canAdvance", () => {
  it("is false when requirement is unmet", () => {
    expect(canAdvance(makeSnapshot())).toBe(false);
  });

  it("is true once the current stage's requirement is met", () => {
    const snapshot = makeSnapshot({ observation: makeObservation() });
    expect(canAdvance(snapshot)).toBe(true);
  });

  it("is false while paused, even if the underlying data would pass", () => {
    const snapshot = makeSnapshot({
      session: makeSession({
        status: "paused",
        currentStage: "observation",
        lastActiveStage: "observation",
      }),
      observation: makeObservation(),
    });
    expect(canAdvance(snapshot)).toBe(false);
  });
});

describe("advanceStage — happy path across the full sequence", () => {
  it("walks observation through feedback to completed", () => {
    let session = makeSession({ currentStage: "observation", status: "observation" });

    const observationSnapshot = makeSnapshot({ session, observation: makeObservation() });
    let result = advanceStage(observationSnapshot, session.stateVersion);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    session = result.session;
    expect(session.currentStage).toBe("separation");
    expect(session.status).toBe("separation");
    expect(session.stateVersion).toBe(1);

    const separationSnapshot = makeSnapshot({
      session,
      observationItems: [
        {
          id: "i1",
          observationId: "o1",
          text: "x",
          type: "fact",
          authorType: "user",
          userConfirmed: true,
          order: 0,
        },
      ],
    });
    result = advanceStage(separationSnapshot, session.stateVersion);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    session = result.session;
    expect(session.currentStage).toBe("questioning");

    const questioningSnapshot = makeSnapshot({ session, questions: passingQuestions() });
    result = advanceStage(questioningSnapshot, session.stateVersion);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    session = result.session;
    expect(session.currentStage).toBe("exploration");

    const explorationSnapshot = makeSnapshot({
      session,
      stageResponses: passingExplorationResponses(),
    });
    result = advanceStage(explorationSnapshot, session.stateVersion);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    session = result.session;
    expect(session.currentStage).toBe("reframing");

    const reframingSnapshot = makeSnapshot({ session, reframes: passingReframes() });
    result = advanceStage(reframingSnapshot, session.stateVersion);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    session = result.session;
    expect(session.currentStage).toBe("definition");

    const definitionSnapshot = makeSnapshot({
      session,
      problemDefinitionVersions: [
        makeProblemDefinitionVersion({ versionNumber: 1, authorType: "user" }),
      ],
    });
    result = advanceStage(definitionSnapshot, session.stateVersion);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    session = result.session;
    expect(session.currentStage).toBe("feedback");
    expect(session.status).toBe("feedback");

    const feedbackSnapshot = makeSnapshot({
      session,
      stageResponses: [
        {
          id: "sc",
          sessionId: session.id,
          stage: "feedback",
          promptKey: "self_checklist_completed",
          content: "done",
          authorType: "user",
          hintLevelUsed: 0,
          isDraft: false,
          isStale: false,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    result = advanceStage(feedbackSnapshot, session.stateVersion);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    session = result.session;
    expect(session.status).toBe("completed");
    expect(session.currentStage).toBe("feedback");
    expect(session.completedAt).toBeTruthy();
    expect(result.viaException).toBe(true); // self-check path
  });
});

describe("advanceStage — wrong order / invalid requests", () => {
  it("rejects a stale stateVersion with wrong_state_version, not silently proceeding", () => {
    const session = makeSession({ stateVersion: 3 });
    const snapshot = makeSnapshot({ session, observation: makeObservation() });
    const result = advanceStage(snapshot, 2);
    expect(result).toMatchObject({ ok: false, errorCode: "wrong_state_version" });
  });

  it("rejects advancing when requirement is not met, with a clear error code", () => {
    const session = makeSession();
    const snapshot = makeSnapshot({ session });
    const result = advanceStage(snapshot, session.stateVersion);
    expect(result).toMatchObject({ ok: false, errorCode: "requirement_not_met" });
  });

  it("rejects advancing a paused session even if underlying data passes", () => {
    const session = makeSession({
      status: "paused",
      currentStage: "observation",
      lastActiveStage: "observation",
    });
    const snapshot = makeSnapshot({ session, observation: makeObservation() });
    const result = advanceStage(snapshot, session.stateVersion);
    expect(result).toMatchObject({ ok: false, errorCode: "invalid_transition" });
  });

  it("rejects advancing a completed session", () => {
    const session = makeSession({ status: "completed", currentStage: "feedback" });
    const snapshot = makeSnapshot({ session });
    const result = advanceStage(snapshot, session.stateVersion);
    expect(result).toMatchObject({ ok: false, errorCode: "invalid_transition" });
  });

  it("never mutates the input session object", () => {
    const session = makeSession();
    const snapshot = makeSnapshot({ session, observation: makeObservation() });
    const before = { ...session };
    advanceStage(snapshot, session.stateVersion);
    expect(session).toEqual(before);
  });
});

describe("pauseSession / resumeSession", () => {
  it("pauses an active session and preserves lastActiveStage", () => {
    const session = makeSession({ currentStage: "exploration", status: "exploration" });
    const result = pauseSession(session, session.stateVersion);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.session.status).toBe("paused");
    expect(result.session.lastActiveStage).toBe("exploration");
    expect(result.session.currentStage).toBe("exploration");
  });

  it("rejects pausing an already-paused session", () => {
    const session = makeSession({ status: "paused", lastActiveStage: "observation" });
    const result = pauseSession(session, session.stateVersion);
    expect(result).toMatchObject({ ok: false, errorCode: "invalid_transition" });
  });

  it("rejects pausing a completed session", () => {
    const session = makeSession({ status: "completed" });
    const result = pauseSession(session, session.stateVersion);
    expect(result).toMatchObject({ ok: false, errorCode: "invalid_transition" });
  });

  it("resumes to exactly the stage it was paused from", () => {
    const session = makeSession({
      status: "paused",
      currentStage: "questioning",
      lastActiveStage: "questioning",
    });
    const result = resumeSession(session, session.stateVersion);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.session.status).toBe("questioning");
  });

  it("rejects resuming a session that isn't paused", () => {
    const session = makeSession({ status: "observation" });
    const result = resumeSession(session, session.stateVersion);
    expect(result).toMatchObject({ ok: false, errorCode: "invalid_transition" });
  });

  it("rejects pause/resume with a stale stateVersion", () => {
    const session = makeSession({ stateVersion: 5 });
    expect(pauseSession(session, 4)).toMatchObject({
      ok: false,
      errorCode: "wrong_state_version",
    });
  });
});

describe("abandonSession", () => {
  it("abandons an active session", () => {
    const session = makeSession({ status: "observation" });
    const result = abandonSession(session, session.stateVersion);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.session.status).toBe("abandoned");
    expect(result.session.abandonedAt).toBeTruthy();
  });

  it("abandons a paused session", () => {
    const session = makeSession({ status: "paused", lastActiveStage: "observation" });
    const result = abandonSession(session, session.stateVersion);
    expect(result).toMatchObject({ ok: true });
  });

  it("rejects abandoning an already-completed session", () => {
    const session = makeSession({ status: "completed" });
    const result = abandonSession(session, session.stateVersion);
    expect(result).toMatchObject({ ok: false, errorCode: "invalid_transition" });
  });

  it("rejects double-abandon", () => {
    const session = makeSession({ status: "abandoned" });
    const result = abandonSession(session, session.stateVersion);
    expect(result).toMatchObject({ ok: false, errorCode: "invalid_transition" });
  });
});

describe("exception paths surface viaException on the transition result", () => {
  it("flags viaException when reframing passes with 1 reframe + reason", () => {
    const session = makeSession({ currentStage: "reframing", status: "reframing" });
    const snapshot = makeSnapshot({
      session,
      reframes: [makeReframe()],
      stageResponses: [
        {
          id: "r",
          sessionId: session.id,
          stage: "reframing",
          promptKey: "reframe_exception_reason",
          content: "막혔어요",
          authorType: "user",
          hintLevelUsed: 0,
          isDraft: false,
          isStale: false,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    const result = advanceStage(snapshot, session.stateVersion);
    expect(result).toMatchObject({ ok: true, viaException: true });
  });

  it("does not flag viaException on the normal path", () => {
    const session = makeSession({ currentStage: "reframing", status: "reframing" });
    const snapshot = makeSnapshot({ session, reframes: passingReframes() });
    const result = advanceStage(snapshot, session.stateVersion);
    expect(result).toMatchObject({ ok: true, viaException: false });
  });
});
