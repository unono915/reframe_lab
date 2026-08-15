import { describe, expect, it } from "vitest";
import { computeGrowthMetrics } from "@/domain/growth/metrics";
import {
  makeProblemDefinitionVersion,
  makeReframe,
  makeSession,
  makeSnapshot,
} from "../training/fixtures";

const TODAY = "2026-08-15"; // 토요일, 그 주 월요일은 2026-08-10

function completedSession(
  trainingDate: string,
  overrides: Parameters<typeof makeSnapshot>[0] = {},
) {
  return makeSnapshot({
    session: makeSession({ trainingDate, status: "completed" }),
    ...overrides,
  });
}

describe("computeGrowthMetrics — 완료 세션만 집계", () => {
  it("완료되지 않은 세션은 어떤 수치에도 포함되지 않는다", () => {
    const inProgress = makeSnapshot({
      session: makeSession({ trainingDate: TODAY, status: "questioning" }),
    });
    const abandoned = makeSnapshot({
      session: makeSession({ trainingDate: TODAY, status: "abandoned" }),
    });
    const metrics = computeGrowthMetrics([inProgress, abandoned], TODAY);
    expect(metrics.totalCompleted).toBe(0);
    expect(metrics.completedThisWeek).toBe(0);
  });

  it("완료 세션은 totalCompleted와 이번 주 카운트에 반영된다", () => {
    const metrics = computeGrowthMetrics([completedSession(TODAY)], TODAY);
    expect(metrics.totalCompleted).toBe(1);
    expect(metrics.completedThisWeek).toBe(1);
  });
});

describe("computeGrowthMetrics — 최근 4주 Rhythm", () => {
  it("항상 4개의 주 버킷을 반환하며 마지막이 이번 주다", () => {
    const metrics = computeGrowthMetrics([], TODAY);
    expect(metrics.recentWeeks).toHaveLength(4);
    expect(metrics.recentWeeks.at(-1)?.weekStart).toBe("2026-08-10");
  });

  it("지난주 완료 세션은 지난주 버킷에, 이번 주 완료는 이번 주 버킷에 들어간다", () => {
    const lastWeek = completedSession("2026-08-05"); // 그 주 월요일 2026-08-03
    const thisWeek = completedSession("2026-08-12"); // 그 주 월요일 2026-08-10
    const metrics = computeGrowthMetrics([lastWeek, thisWeek], TODAY);
    const byWeek = Object.fromEntries(metrics.recentWeeks.map((w) => [w.weekStart, w.completedCount]));
    expect(byWeek["2026-08-03"]).toBe(1);
    expect(byWeek["2026-08-10"]).toBe(1);
  });

  it("4주보다 오래된 완료 세션은 버킷에 포함되지 않는다(총계에는 포함)", () => {
    const old = completedSession("2026-06-01");
    const metrics = computeGrowthMetrics([old], TODAY);
    expect(metrics.totalCompleted).toBe(1);
    expect(metrics.recentWeeks.every((w) => w.completedCount === 0)).toBe(true);
  });
});

describe("computeGrowthMetrics — 사용자 작성 재정의 수", () => {
  it("사용자가 작성한 reframe만 센다(AI 작성은 제외)", () => {
    const session = completedSession(TODAY, {
      reframes: [
        makeReframe({ authorType: "user" }),
        makeReframe({ authorType: "user" }),
        makeReframe({ authorType: "ai" }),
      ],
    });
    const metrics = computeGrowthMetrics([session], TODAY);
    expect(metrics.userAuthoredReframeCount).toBe(2);
  });

  it("여러 세션에 걸쳐 합산한다", () => {
    const a = completedSession(TODAY, { reframes: [makeReframe({ authorType: "user" })] });
    const b = completedSession(TODAY, { reframes: [makeReframe({ authorType: "user" })] });
    const metrics = computeGrowthMetrics([a, b], TODAY);
    expect(metrics.userAuthoredReframeCount).toBe(2);
  });
});

describe("computeGrowthMetrics — 정의 수정 완료 비율", () => {
  it("v1만 있으면 수정한 기록으로 세지 않는다", () => {
    const session = completedSession(TODAY, {
      problemDefinitionVersions: [makeProblemDefinitionVersion({ versionNumber: 1 })],
    });
    const metrics = computeGrowthMetrics([session], TODAY);
    expect(metrics.revisedDefinitionSessionCount).toBe(0);
    expect(metrics.revisedDefinitionRatio).toBe(0);
  });

  it("사용자가 작성한 v2가 있으면 수정한 기록으로 센다", () => {
    const session = completedSession(TODAY, {
      problemDefinitionVersions: [
        makeProblemDefinitionVersion({ versionNumber: 1 }),
        makeProblemDefinitionVersion({ versionNumber: 2, authorType: "user" }),
      ],
    });
    const metrics = computeGrowthMetrics([session], TODAY);
    expect(metrics.revisedDefinitionSessionCount).toBe(1);
    expect(metrics.revisedDefinitionRatio).toBe(1);
  });

  it("비율은 전체 완료 세션 대비로 계산된다", () => {
    const revised = completedSession(TODAY, {
      problemDefinitionVersions: [
        makeProblemDefinitionVersion({ versionNumber: 1 }),
        makeProblemDefinitionVersion({ versionNumber: 2, authorType: "user" }),
      ],
    });
    const notRevised = completedSession(TODAY, {
      problemDefinitionVersions: [makeProblemDefinitionVersion({ versionNumber: 1 })],
    });
    const metrics = computeGrowthMetrics([revised, notRevised], TODAY);
    expect(metrics.revisedDefinitionSessionCount).toBe(1);
    expect(metrics.revisedDefinitionRatio).toBe(0.5);
  });

  it("완료 세션이 0개면 비율은 0이다(0으로 나누지 않는다)", () => {
    const metrics = computeGrowthMetrics([], TODAY);
    expect(metrics.revisedDefinitionRatio).toBe(0);
  });
});
