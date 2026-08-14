import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  clearSessionDrafts,
  createDebouncedDraftSaver,
  deleteDraft,
  getDraft,
  getDraftsForSession,
  saveDraft,
} from "@/lib/persistence/drafts";

let sessionCounter = 0;
function uniqueSessionId(): string {
  sessionCounter += 1;
  return `session-${sessionCounter}`;
}

describe("saveDraft / getDraft", () => {
  it("round-trips content for a (sessionId, stage, promptKey) key", async () => {
    const sessionId = uniqueSessionId();
    await saveDraft({
      sessionId,
      stage: "observation",
      promptKey: "raw_text",
      content: "장면 하나",
    });
    const draft = await getDraft(sessionId, "observation", "raw_text");
    expect(draft?.content).toBe("장면 하나");
    expect(draft?.sessionId).toBe(sessionId);
    expect(draft?.schemaVersion).toBe(1);
  });

  it("overwrites the previous draft for the same key rather than duplicating it", async () => {
    const sessionId = uniqueSessionId();
    await saveDraft({
      sessionId,
      stage: "observation",
      promptKey: "raw_text",
      content: "첫 초안",
    });
    await saveDraft({
      sessionId,
      stage: "observation",
      promptKey: "raw_text",
      content: "고친 초안",
    });
    const draft = await getDraft(sessionId, "observation", "raw_text");
    expect(draft?.content).toBe("고친 초안");

    const all = await getDraftsForSession(sessionId);
    expect(all).toHaveLength(1);
  });

  it("keeps drafts for different stages/promptKeys independent", async () => {
    const sessionId = uniqueSessionId();
    await saveDraft({
      sessionId,
      stage: "exploration",
      promptKey: "context",
      content: "A",
    });
    await saveDraft({
      sessionId,
      stage: "exploration",
      promptKey: "impact",
      content: "B",
    });
    await saveDraft({
      sessionId,
      stage: "observation",
      promptKey: "raw_text",
      content: "C",
    });

    expect((await getDraft(sessionId, "exploration", "context"))?.content).toBe("A");
    expect((await getDraft(sessionId, "exploration", "impact"))?.content).toBe("B");
    expect((await getDraft(sessionId, "observation", "raw_text"))?.content).toBe("C");
  });

  it("returns undefined for a draft that was never saved", async () => {
    const sessionId = uniqueSessionId();
    expect(await getDraft(sessionId, "observation", "raw_text")).toBeUndefined();
  });
});

describe("getDraftsForSession", () => {
  it("only returns drafts belonging to that session (index isolation)", async () => {
    const sessionA = uniqueSessionId();
    const sessionB = uniqueSessionId();
    await saveDraft({
      sessionId: sessionA,
      stage: "observation",
      promptKey: "raw_text",
      content: "A",
    });
    await saveDraft({
      sessionId: sessionB,
      stage: "observation",
      promptKey: "raw_text",
      content: "B",
    });

    const draftsA = await getDraftsForSession(sessionA);
    expect(draftsA).toHaveLength(1);
    expect(draftsA[0]?.content).toBe("A");
  });
});

describe("deleteDraft / clearSessionDrafts", () => {
  it("removes a single draft by key", async () => {
    const sessionId = uniqueSessionId();
    await saveDraft({
      sessionId,
      stage: "observation",
      promptKey: "raw_text",
      content: "x",
    });
    await deleteDraft(sessionId, "observation", "raw_text");
    expect(await getDraft(sessionId, "observation", "raw_text")).toBeUndefined();
  });

  it("clears every draft for a session once the stage is confirmed on the server", async () => {
    const sessionId = uniqueSessionId();
    await saveDraft({
      sessionId,
      stage: "observation",
      promptKey: "raw_text",
      content: "x",
    });
    await saveDraft({
      sessionId,
      stage: "exploration",
      promptKey: "context",
      content: "y",
    });
    await clearSessionDrafts(sessionId);
    expect(await getDraftsForSession(sessionId)).toEqual([]);
  });

  it("clearing one session never touches another session's drafts", async () => {
    const sessionA = uniqueSessionId();
    const sessionB = uniqueSessionId();
    await saveDraft({
      sessionId: sessionA,
      stage: "observation",
      promptKey: "raw_text",
      content: "A",
    });
    await saveDraft({
      sessionId: sessionB,
      stage: "observation",
      promptKey: "raw_text",
      content: "B",
    });
    await clearSessionDrafts(sessionA);
    expect(await getDraftsForSession(sessionA)).toEqual([]);
    expect(await getDraftsForSession(sessionB)).toHaveLength(1);
  });
});

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("createDebouncedDraftSaver", () => {
  it("does not save before the delay elapses", async () => {
    const sessionId = uniqueSessionId();
    const debouncedSave = createDebouncedDraftSaver(80);
    debouncedSave({
      sessionId,
      stage: "observation",
      promptKey: "raw_text",
      content: "타이핑 중",
    });
    await wait(30);
    expect(await getDraft(sessionId, "observation", "raw_text")).toBeUndefined();
  });

  it("collapses rapid successive calls into a single save of the last value", async () => {
    const sessionId = uniqueSessionId();
    const debouncedSave = createDebouncedDraftSaver(60);
    debouncedSave({
      sessionId,
      stage: "observation",
      promptKey: "raw_text",
      content: "ㅇ",
    });
    await wait(20);
    debouncedSave({
      sessionId,
      stage: "observation",
      promptKey: "raw_text",
      content: "안",
    });
    await wait(20);
    debouncedSave({
      sessionId,
      stage: "observation",
      promptKey: "raw_text",
      content: "안녕",
    });
    await wait(120);

    const draft = await getDraft(sessionId, "observation", "raw_text");
    expect(draft?.content).toBe("안녕");

    const all = await getDraftsForSession(sessionId);
    expect(all).toHaveLength(1);
  });
});
