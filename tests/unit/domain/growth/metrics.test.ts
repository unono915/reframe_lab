import { describe, expect, it } from "vitest";
import { computeGrowthMetrics, computeShift } from "@/domain/growth/metrics";
import { EMPTY_QUALITY_SIGNALS } from "@/domain/growth/quality";
import type { SessionSummary } from "@/domain/types";

const TODAY = "2026-08-15"; // 토요일, 그 주 월요일은 2026-08-10

let idCounter = 0;
function makeSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  idCounter += 1;
  return {
    id: `session-${idCounter}`,
    trainingDate: TODAY,
    status: "completed",
    templateId: "template-1",
    observationText: "회의 때마다 같은 사람이 늦게 들어온다",
    latestDefinitionText: "회의 시작 시각과 이동 동선이 맞지 않는다",
    userReframeCount: 0,
    hasUserRevisedDefinition: false,
    qualitySignals: EMPTY_QUALITY_SIGNALS,
    ...overrides,
  };
}

describe("computeGrowthMetrics — 완료 세션만 집계", () => {
  it("완료되지 않은 세션은 어떤 수치에도 포함되지 않는다", () => {
    const metrics = computeGrowthMetrics(
      [makeSummary({ status: "questioning" }), makeSummary({ status: "abandoned" })],
      TODAY,
    );
    expect(metrics.totalCompleted).toBe(0);
    expect(metrics.completedThisWeek).toBe(0);
  });

  it("완료 세션은 totalCompleted와 이번 주 카운트에 반영된다", () => {
    const metrics = computeGrowthMetrics([makeSummary()], TODAY);
    expect(metrics.totalCompleted).toBe(1);
    expect(metrics.completedThisWeek).toBe(1);
  });

  it("보류(paused) 세션도 완료로 세지 않는다", () => {
    const metrics = computeGrowthMetrics([makeSummary({ status: "paused" })], TODAY);
    expect(metrics.totalCompleted).toBe(0);
  });
});

describe("computeGrowthMetrics — 최근 4주 Rhythm", () => {
  it("항상 4개의 주 버킷을 반환하며 마지막이 이번 주다", () => {
    const metrics = computeGrowthMetrics([], TODAY);
    expect(metrics.recentWeeks).toHaveLength(4);
    expect(metrics.recentWeeks.at(-1)?.weekStart).toBe("2026-08-10");
  });

  it("지난주 완료 세션은 지난주 버킷에, 이번 주 완료는 이번 주 버킷에 들어간다", () => {
    const metrics = computeGrowthMetrics(
      [
        makeSummary({ trainingDate: "2026-08-05" }), // 그 주 월요일 2026-08-03
        makeSummary({ trainingDate: "2026-08-12" }), // 그 주 월요일 2026-08-10
      ],
      TODAY,
    );
    const byWeek = Object.fromEntries(
      metrics.recentWeeks.map((w) => [w.weekStart, w.completedCount]),
    );
    expect(byWeek["2026-08-03"]).toBe(1);
    expect(byWeek["2026-08-10"]).toBe(1);
  });

  it("4주보다 오래된 완료 세션은 버킷에 포함되지 않는다(총계에는 포함)", () => {
    const metrics = computeGrowthMetrics([makeSummary({ trainingDate: "2026-06-01" })], TODAY);
    expect(metrics.totalCompleted).toBe(1);
    expect(metrics.recentWeeks.every((w) => w.completedCount === 0)).toBe(true);
  });

  it("주 경계(월요일 당일)는 그 주에 포함된다", () => {
    const metrics = computeGrowthMetrics([makeSummary({ trainingDate: "2026-08-10" })], TODAY);
    expect(metrics.completedThisWeek).toBe(1);
  });
});

describe("computeGrowthMetrics — 사용자 작성 재정의 수", () => {
  it("세션별 userReframeCount를 합산한다", () => {
    const metrics = computeGrowthMetrics(
      [makeSummary({ userReframeCount: 2 }), makeSummary({ userReframeCount: 3 })],
      TODAY,
    );
    expect(metrics.userAuthoredReframeCount).toBe(5);
  });

  it("완료되지 않은 세션의 재정의는 합산하지 않는다", () => {
    const metrics = computeGrowthMetrics(
      [makeSummary({ status: "reframing", userReframeCount: 5 })],
      TODAY,
    );
    expect(metrics.userAuthoredReframeCount).toBe(0);
  });
});

describe("computeGrowthMetrics — 정의 수정 완료 비율", () => {
  it("v1만 있으면 수정한 기록으로 세지 않는다", () => {
    const metrics = computeGrowthMetrics(
      [makeSummary({ hasUserRevisedDefinition: false })],
      TODAY,
    );
    expect(metrics.revisedDefinitionSessionCount).toBe(0);
    expect(metrics.revisedDefinitionRatio).toBe(0);
  });

  it("사용자가 작성한 v2가 있으면 수정한 기록으로 센다", () => {
    const metrics = computeGrowthMetrics(
      [makeSummary({ hasUserRevisedDefinition: true })],
      TODAY,
    );
    expect(metrics.revisedDefinitionSessionCount).toBe(1);
    expect(metrics.revisedDefinitionRatio).toBe(1);
  });

  it("비율은 전체 완료 세션 대비로 계산된다", () => {
    const metrics = computeGrowthMetrics(
      [
        makeSummary({ hasUserRevisedDefinition: true }),
        makeSummary({ hasUserRevisedDefinition: false }),
      ],
      TODAY,
    );
    expect(metrics.revisedDefinitionSessionCount).toBe(1);
    expect(metrics.revisedDefinitionRatio).toBe(0.5);
  });

  it("완료 세션이 0개면 비율은 0이다(0으로 나누지 않는다)", () => {
    expect(computeGrowthMetrics([], TODAY).revisedDefinitionRatio).toBe(0);
  });
});

describe("computeShift — 초기 절반 대 최근 절반", () => {
  it("표본이 4개 미만이면 추세를 말하지 않는다", () => {
    expect(computeShift([0.1, 0.9])).toBeNull();
    expect(computeShift([0.1, 0.5, 0.9])).toBeNull();
  });

  it("앞 절반과 뒤 절반의 평균을 비교한다", () => {
    const shift = computeShift([0, 0, 1, 1]);
    expect(shift?.earlier).toBe(0);
    expect(shift?.recent).toBe(1);
    expect(shift?.delta).toBe(1);
    expect(shift?.sampleSize).toBe(4);
  });

  /**
   * 홀수 표본에서 가운데 값을 양쪽에 모두 넣으면 차이가 과장된다 — 표본이 적을수록
   * 그 왜곡이 커서, 가운데 한 점은 어느 쪽에도 넣지 않는다.
   */
  it("홀수면 가운데 점을 양쪽 어디에도 넣지 않는다", () => {
    const shift = computeShift([0, 0, 100, 1, 1]);
    expect(shift?.earlier).toBe(0);
    expect(shift?.recent).toBe(1);
  });
});

describe("computeGrowthMetrics — 품질 변화 지표", () => {
  function withSignals(
    trainingDate: string,
    signals: Partial<SessionSummary["qualitySignals"]>,
  ): SessionSummary {
    return makeSummary({
      trainingDate,
      qualitySignals: { ...EMPTY_QUALITY_SIGNALS, ...signals },
    });
  }

  it("차원 충족도 추이는 시간순(오래된 것 → 최근)이다", () => {
    const metrics = computeGrowthMetrics(
      [
        withSignals("2026-08-14", { assessedDimensions: 6, shownDimensions: 6 }),
        withSignals("2026-08-10", { assessedDimensions: 6, shownDimensions: 3 }),
      ],
      TODAY,
    );
    expect(metrics.coverageTrend.map((p) => p.trainingDate)).toEqual([
      "2026-08-10",
      "2026-08-14",
    ]);
    expect(metrics.coverageTrend.map((p) => p.value)).toEqual([0.5, 1]);
  });

  it("AI 판정이 없는 세션은 충족도 추이에서 빠진다", () => {
    const metrics = computeGrowthMetrics(
      [withSignals("2026-08-10", { assessedDimensions: 0, shownDimensions: 0 })],
      TODAY,
    );
    expect(metrics.coverageTrend).toEqual([]);
  });

  it("비교 불가(null)인 세션은 보정 추이에서 빠진다", () => {
    const metrics = computeGrowthMetrics(
      [
        withSignals("2026-08-10", { overconfidentDimensions: null }),
        withSignals("2026-08-11", { overconfidentDimensions: 2 }),
      ],
      TODAY,
    );
    expect(metrics.calibrationTrend).toHaveLength(1);
    expect(metrics.calibrationTrend[0]?.value).toBe(2);
  });

  it("AI 없이 완주한 세션을 따로 센다 (P1-6 전이 프로브)", () => {
    const metrics = computeGrowthMetrics(
      [
        withSignals("2026-08-10", { completedWithoutAi: true }),
        withSignals("2026-08-11", { completedWithoutAi: false }),
      ],
      TODAY,
    );
    expect(metrics.completedWithoutAiCount).toBe(1);
  });

  it("완료되지 않은 세션은 품질 추이에도 들어가지 않는다", () => {
    const metrics = computeGrowthMetrics(
      [
        makeSummary({
          status: "paused",
          qualitySignals: {
            ...EMPTY_QUALITY_SIGNALS,
            assessedDimensions: 6,
            shownDimensions: 6,
          },
        }),
      ],
      TODAY,
    );
    expect(metrics.coverageTrend).toEqual([]);
  });
});
