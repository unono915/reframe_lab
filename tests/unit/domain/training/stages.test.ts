import { describe, expect, it } from "vitest";
import {
  isBeforeStage,
  nextStageOf,
  stageIndex,
  stageLabel,
  STAGE_LABELS,
  STAGE_ORDER,
  TOTAL_ACTIVE_STAGES,
} from "@/domain/training/stages";

describe("STAGE_ORDER", () => {
  it("excludes not_started and has 7 active stages", () => {
    expect(STAGE_ORDER).not.toContain("not_started");
    expect(STAGE_ORDER).toHaveLength(7);
    expect(TOTAL_ACTIVE_STAGES).toBe(7);
  });

  it("matches PRD §12.1 order exactly", () => {
    expect(STAGE_ORDER).toEqual([
      "observation",
      "separation",
      "questioning",
      "exploration",
      "reframing",
      "definition",
      "feedback",
    ]);
  });

  it("every active stage has a DESIGN.md §9.12 label", () => {
    for (const stage of STAGE_ORDER) {
      expect(STAGE_LABELS[stage]).toBeTruthy();
    }
  });
});

describe("stageIndex", () => {
  it("returns -1 for not_started", () => {
    expect(stageIndex("not_started")).toBe(-1);
  });

  it("returns ascending indices for active stages", () => {
    expect(stageIndex("observation")).toBe(0);
    expect(stageIndex("feedback")).toBe(6);
  });
});

describe("isBeforeStage", () => {
  it("treats not_started as before every active stage", () => {
    expect(isBeforeStage("not_started", "observation")).toBe(true);
  });

  it("orders active stages correctly", () => {
    expect(isBeforeStage("observation", "definition")).toBe(true);
    expect(isBeforeStage("feedback", "observation")).toBe(false);
    expect(isBeforeStage("questioning", "questioning")).toBe(false);
  });
});

describe("nextStageOf", () => {
  it("walks the full sequence", () => {
    expect(nextStageOf("not_started")).toBe("observation");
    expect(nextStageOf("observation")).toBe("separation");
    expect(nextStageOf("definition")).toBe("feedback");
  });

  it("returns null after the last stage", () => {
    expect(nextStageOf("feedback")).toBeNull();
  });
});

describe("stageLabel", () => {
  it("returns the Korean UI label, not the internal id", () => {
    expect(stageLabel("separation")).toBe("구분");
    expect(stageLabel("feedback")).toBe("돌아보기");
    expect(stageLabel("not_started")).toBe("시작 전");
  });
});
