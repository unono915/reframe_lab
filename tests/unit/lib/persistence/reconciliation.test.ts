import { describe, expect, it } from "vitest";
import { findConflictingDrafts } from "@/lib/persistence/reconciliation";
import { STAGE_ORDER } from "@/domain/training/stages";
import type { DraftRecord } from "@/lib/persistence/drafts";

function draft(stage: DraftRecord["stage"], promptKey = "x"): DraftRecord {
  return {
    sessionId: "s1",
    stage,
    promptKey,
    content: `draft for ${stage}`,
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
  };
}

describe("findConflictingDrafts", () => {
  it("returns drafts for stages the server has already moved past", () => {
    const drafts = [draft("observation"), draft("separation")];
    const result = findConflictingDrafts(drafts, "questioning", STAGE_ORDER);
    expect(result).toHaveLength(2);
  });

  it("does not flag a draft for the current stage", () => {
    const drafts = [draft("observation")];
    const result = findConflictingDrafts(drafts, "observation", STAGE_ORDER);
    expect(result).toHaveLength(0);
  });

  it("does not flag a draft for a future stage", () => {
    const drafts = [draft("feedback")];
    const result = findConflictingDrafts(drafts, "observation", STAGE_ORDER);
    expect(result).toHaveLength(0);
  });

  it("returns an empty array when nothing conflicts", () => {
    expect(findConflictingDrafts([], "observation", STAGE_ORDER)).toEqual([]);
  });
});
