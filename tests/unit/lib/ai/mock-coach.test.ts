import { describe, expect, it } from "vitest";
import { mockCoachProvider } from "@/lib/ai/providers/mock";
import { coachOutputSchema } from "@/lib/schemas/coach-output";
import { getFallbackQuestion, SELF_CHECK_ITEMS } from "@/lib/ai/fallback";
import { STAGE_ORDER } from "@/domain/training/stages";

describe("mockCoachProvider — always returns exactly one valid question", () => {
  it("satisfies coachOutputSchema for every stage and hint level", async () => {
    for (const stage of STAGE_ORDER) {
      for (const hintLevel of [0, 1, 2] as const) {
        const output = await mockCoachProvider.getCoachResponse({
          stage,
          hintLevel,
          userText: "테스트 입력",
        });
        const result = coachOutputSchema.safeParse(output);
        expect(result.success, `${stage}/${hintLevel}: ${JSON.stringify(result)}`).toBe(
          true,
        );
      }
    }
  });

  it("never returns a null question — the mock coach always has something to ask", async () => {
    const output = await mockCoachProvider.getCoachResponse({
      stage: "observation",
      hintLevel: 0,
      userText: "",
    });
    expect(typeof output.question).toBe("string");
    expect(output.question).toBeTruthy();
  });

  it("never fabricates evidence — evidenceReferences is always empty", async () => {
    const output = await mockCoachProvider.getCoachResponse({
      stage: "questioning",
      hintLevel: 1,
      userText: "아무 근거도 없는 입력",
    });
    expect(output.evidenceReferences).toEqual([]);
  });

  it("is deterministic for the same (stage, hintLevel)", async () => {
    const a = await mockCoachProvider.getCoachResponse({
      stage: "reframing",
      hintLevel: 2,
      userText: "x",
    });
    const b = await mockCoachProvider.getCoachResponse({
      stage: "reframing",
      hintLevel: 2,
      userText: "y",
    });
    expect(a.question).toBe(b.question);
  });
});

describe("getFallbackQuestion", () => {
  it("returns a distinct question per hint level within a stage", () => {
    const questions = new Set(
      [0, 1, 2].map((level) => getFallbackQuestion("observation", level as 0 | 1 | 2)),
    );
    expect(questions.size).toBe(3);
  });

  it("has a question bank entry for every active stage", () => {
    for (const stage of STAGE_ORDER) {
      expect(getFallbackQuestion(stage, 0)).toBeTruthy();
    }
  });
});

describe("SELF_CHECK_ITEMS", () => {
  it("covers PRD §7.8's 6 quality dimensions with unique keys", () => {
    expect(SELF_CHECK_ITEMS).toHaveLength(6);
    const keys = new Set(SELF_CHECK_ITEMS.map((item) => item.key));
    expect(keys.size).toBe(6);
  });
});
