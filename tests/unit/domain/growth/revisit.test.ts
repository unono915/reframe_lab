import { describe, expect, it } from "vitest";
import { EMPTY_QUALITY_SIGNALS } from "@/domain/growth/quality";
import { daysSince, suggestRevisitCandidate } from "@/domain/growth/revisit";
import type { SessionSummary } from "@/domain/types";

const TODAY = "2026-09-02";

let counter = 0;
function makeSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  counter += 1;
  return {
    id: `session-${counter}`,
    trainingDate: TODAY,
    status: "completed",
    templateId: "template-1",
    observationText: "회의가 점심시간에 잡혔다",
    latestDefinitionText: "회의 시간이 식사 시간과 겹친다",
    userReframeCount: 2,
    hasUserRevisedDefinition: false,
    qualitySignals: EMPTY_QUALITY_SIGNALS,
    ...overrides,
  };
}

describe("suggestRevisitCandidate", () => {
  it("기록이 없으면 제안하지 않는다", () => {
    expect(suggestRevisitCandidate([], TODAY)).toBeNull();
  });

  it("14일이 지나지 않은 기록은 제안하지 않는다", () => {
    const recent = makeSummary({ trainingDate: "2026-08-25" }); // 8일 전
    expect(suggestRevisitCandidate([recent], TODAY)).toBeNull();
  });

  it("14일이 지난 완료 기록을 제안한다", () => {
    const old = makeSummary({ id: "old", trainingDate: "2026-08-01" });
    expect(suggestRevisitCandidate([old], TODAY)?.id).toBe("old");
  });

  it("완료되지 않은 기록은 제안하지 않는다", () => {
    const paused = makeSummary({ trainingDate: "2026-08-01", status: "paused" });
    expect(suggestRevisitCandidate([paused], TODAY)).toBeNull();
  });

  /** 이미 다시 본 원본을 또 권하면 같은 기록만 반복해서 뜬다. */
  it("이미 다시 본 원본은 다시 제안하지 않는다", () => {
    const original = makeSummary({ id: "original", trainingDate: "2026-08-01" });
    const derived = makeSummary({ id: "derived", originSessionId: "original" });
    expect(suggestRevisitCandidate([original, derived], TODAY)).toBeNull();
  });

  it("여러 후보 중 가장 오래된 것을 고른다", () => {
    const older = makeSummary({ id: "older", trainingDate: "2026-07-01" });
    const newer = makeSummary({ id: "newer", trainingDate: "2026-08-01" });
    expect(suggestRevisitCandidate([newer, older], TODAY)?.id).toBe("older");
  });

  it("경계값(정확히 14일)은 포함한다", () => {
    const exactly = makeSummary({ id: "exactly", trainingDate: "2026-08-19" });
    expect(suggestRevisitCandidate([exactly], TODAY)?.id).toBe("exactly");
  });
});

describe("daysSince", () => {
  it("지난 일수를 센다", () => {
    expect(daysSince(makeSummary({ trainingDate: "2026-08-19" }), TODAY)).toBe(14);
  });
});
