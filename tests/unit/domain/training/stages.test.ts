import { describe, expect, it } from "vitest";
import {
  isBeforeStage,
  nextStageOf,
  stageIndex,
  stageLabel,
  stageRationale,
  STAGE_LABELS,
  STAGE_ORDER,
  STAGE_RATIONALE,
  sessionStatusLabel,
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

describe("stageRationale", () => {
  it("every active stage explains why it exists (P0-3 명시적 교육)", () => {
    for (const stage of STAGE_ORDER) {
      expect(STAGE_RATIONALE[stage]).toBeTruthy();
    }
  });

  it("returns null for not_started — 시작 전에는 설명할 단계가 없다", () => {
    expect(stageRationale("not_started")).toBeNull();
  });

  /**
   * 이 문장들은 "왜"를 설명하는 것이지 "이렇게 쓰세요"가 아니다. 답을 예시로 주면
   * 원칙 3(AI가 대신 정의하지 않는다)의 취지를 UI가 우회하게 된다 — 문구를 고칠 때
   * 이 선을 넘지 않도록 잡아두는 테스트다.
   */
  it("does not hand the user a model answer", () => {
    for (const stage of STAGE_ORDER) {
      expect(STAGE_RATIONALE[stage]).not.toMatch(/예를 들어|이렇게 쓰|예시:/);
    }
  });

  it("재정의 단계는 고착 경향을 명시적으로 알려준다", () => {
    // Einstellung 연구: 편향의 존재를 알려주기만 해도 고착이 유의하게 줄었다.
    expect(STAGE_RATIONALE.reframing).toContain("고정");
  });
});

describe("sessionStatusLabel", () => {
  it("완료·보류·중단을 각각 구분해 보여준다", () => {
    expect(sessionStatusLabel("completed")).toBe("완료");
    expect(sessionStatusLabel("paused")).toBe("보류 중");
    expect(sessionStatusLabel("abandoned")).toBe("중단됨");
  });

  it("진행 중인 세션은 어느 단계인지까지 알려준다", () => {
    expect(sessionStatusLabel("questioning")).toBe("진행 중 · 질문");
    expect(sessionStatusLabel("feedback")).toBe("진행 중 · 돌아보기");
  });

  /**
   * Phase 5 완료 조건: "연속 기록이 끊겨도 비난·실패 표현 없음". 중단된 기록을
   * "포기"·"실패"로 부르지 않는 것은 문구 취향이 아니라 요구사항이다.
   */
  it("어떤 상태도 사용자를 실패로 규정하지 않는다", () => {
    const blaming = ["실패", "포기", "미완", "중도"];
    for (const status of [
      "completed",
      "paused",
      "abandoned",
      "observation",
      "feedback",
    ] as const) {
      const label = sessionStatusLabel(status);
      for (const word of blaming) {
        expect(label, `${status} → "${label}"`).not.toContain(word);
      }
    }
  });
});

describe("stageRationale", () => {
  it("활성 단계마다 왜 하는지 한 줄을 준다 (P0-3 명시적 교육)", () => {
    for (const stage of STAGE_ORDER) {
      expect(stageRationale(stage), stage).toBeTruthy();
    }
  });

  it("시작 전에는 설명할 단계가 없다", () => {
    expect(stageRationale("not_started")).toBeNull();
  });
});
