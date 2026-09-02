import { describe, expect, it } from "vitest";
import { deriveQualitySignals } from "@/domain/growth/quality";
import type { AIFeedbackDimension } from "@/domain/types";

/** AI 차원 키(camelCase)로 판정을 만든다 — 자기 점검 키와 이름 체계가 다르다. */
function dims(entries: Record<string, AIFeedbackDimension["status"]>) {
  return Object.fromEntries(
    Object.entries(entries).map(([k, status]) => [k, { status, evidence: "" }]),
  ) as Record<string, AIFeedbackDimension>;
}

const NO_HINTS = { hintLevels: [] as const, aiCallCount: 1, soloMode: false };

describe("deriveQualitySignals — 차원 충족도", () => {
  it("AI가 판정한 차원만 분모에 넣는다", () => {
    const result = deriveQualitySignals({
      dimensions: dims({ evidence: "shown", perspectiveAndScope: "explore_further" }),
      selfAssessment: {},
      ...NO_HINTS,
    });
    expect(result.assessedDimensions).toBe(2);
    expect(result.shownDimensions).toBe(1);
  });

  it("explore_further와 unverified는 둘 다 '드러나지 않음'이다", () => {
    const result = deriveQualitySignals({
      dimensions: dims({ evidence: "explore_further", userAndContext: "unverified" }),
      selfAssessment: {},
      ...NO_HINTS,
    });
    expect(result.shownDimensions).toBe(0);
  });

  it("피드백이 없으면 분모가 0이라 추이에서 제외된다", () => {
    const result = deriveQualitySignals({
      dimensions: null,
      selfAssessment: { scope: "shown" },
      ...NO_HINTS,
    });
    expect(result.assessedDimensions).toBe(0);
  });
});

describe("deriveQualitySignals — 과신 차원", () => {
  it("스스로 shown인데 AI가 아니라고 본 차원만 센다", () => {
    const result = deriveQualitySignals({
      // scope ↔ perspectiveAndScope, observation_evidence ↔ evidence 로 매핑된다.
      dimensions: dims({ perspectiveAndScope: "unverified", evidence: "shown" }),
      selfAssessment: { scope: "shown", observation_evidence: "shown" },
      ...NO_HINTS,
    });
    expect(result.overconfidentDimensions).toBe(1);
  });

  it("과소평가(스스로 아직 · AI는 드러남)는 과신으로 세지 않는다", () => {
    const result = deriveQualitySignals({
      dimensions: dims({ evidence: "shown" }),
      selfAssessment: { observation_evidence: "not_yet" },
      ...NO_HINTS,
    });
    expect(result.overconfidentDimensions).toBe(0);
  });

  /**
   * null과 0을 구분하는 것이 핵심이다. 자기평가가 없어서 비교를 못 한 세션을 0("어긋남
   * 없음")으로 세면 보정 추이가 실제보다 좋아 보인다.
   */
  it("비교할 수 없으면 0이 아니라 null이다", () => {
    const result = deriveQualitySignals({
      dimensions: dims({ evidence: "shown" }),
      selfAssessment: {},
      ...NO_HINTS,
    });
    expect(result.overconfidentDimensions).toBeNull();
  });
});

describe("deriveQualitySignals — 힌트 의존도와 전이 프로브", () => {
  it("Level 2 힌트만 강한 힌트로 센다", () => {
    const result = deriveQualitySignals({
      dimensions: null,
      selfAssessment: {},
      hintLevels: [0, 1, 2, 2],
      aiCallCount: 4,
      soloMode: false,
    });
    expect(result.hintCallCount).toBe(4);
    expect(result.strongHintCount).toBe(2);
  });

  it("혼자 해보기를 선택하고 AI를 안 썼을 때만 전이 프로브다", () => {
    const result = deriveQualitySignals({
      dimensions: null,
      selfAssessment: {},
      hintLevels: [],
      aiCallCount: 0,
      soloMode: true,
    });
    expect(result.completedWithoutAi).toBe(true);
  });

  /**
   * 제공자가 연결되기 전의 과거 기록도 aiCallCount === 0이다. 그것까지 세면
   * Growth가 "혼자 해낸 기록"을 실제보다 부풀려 보여준다 — 실제로 그렇게 보였다.
   */
  it("선택하지 않았는데 우연히 AI를 안 쓴 것은 전이 프로브가 아니다", () => {
    const result = deriveQualitySignals({
      dimensions: null,
      selfAssessment: {},
      hintLevels: [],
      aiCallCount: 0,
      soloMode: false,
    });
    expect(result.completedWithoutAi).toBe(false);
  });

  it("혼자 하기로 해놓고 AI를 썼으면 전이 프로브가 아니다", () => {
    const result = deriveQualitySignals({
      dimensions: null,
      selfAssessment: {},
      hintLevels: [0],
      aiCallCount: 1,
      soloMode: true,
    });
    expect(result.completedWithoutAi).toBe(false);
  });
});
