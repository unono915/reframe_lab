import { describe, expect, it } from "vitest";
import { getFallbackQuestion } from "@/lib/ai/fallback";
import { checkNoFabricatedNumbers, checkNoSolution } from "@/lib/ai/guardrails";
import { STAGE_ORDER } from "@/domain/training/stages";
import type { HintLevel } from "@/domain/types";

/**
 * Guardrail의 눈금을 이 앱 자신의 코칭 어휘로 맞춰두는 테스트.
 *
 * `lib/ai/fallback.ts`의 질문 은행은 **이 제품이 좋은 코칭이라고 보는 문장들**이다 —
 * AI가 죽었을 때 사용자에게 실제로 내보내는 질문이기도 하다. 그러니 우리 Guardrail이
 * 그중 하나라도 거부한다면, 눈금이 틀린 쪽은 질문이 아니라 Guardrail이다.
 *
 * 이 테스트가 필요한 이유는 실제 이력에 있다. 해결책 제안 검사는 한때
 * `~해 보세요`를 통째로 위반으로 봤고, 그 바람에 "확인해 보세요"·"비교해 보세요"
 * 같은 정상적인 코칭이 매번 거부돼 사용자는 맞춤 질문 대신 fallback을 받았다.
 * 사고 동사 목록을 늘리거나 검사를 새 필드로 확장할 때마다, 그 변경이 이 21개
 * 질문을 여전히 통과시키는지가 가장 값싼 확인이다.
 */
const HINT_LEVELS: HintLevel[] = [0, 1, 2];

function allFallbackQuestions(): { stage: string; level: HintLevel; text: string }[] {
  // STAGE_ORDER는 이미 활성 단계 7개만 담고 있다.
  return STAGE_ORDER.flatMap((stage) =>
    HINT_LEVELS.map((level) => ({
      stage,
      level,
      text: getFallbackQuestion(stage, level),
    })),
  );
}

describe("규칙 기반 질문은 우리 Guardrail을 통과해야 한다", () => {
  it("질문 은행이 비어 있지 않다", () => {
    // 은행이 비면 아래 검사들이 아무것도 확인하지 않은 채 통과한다.
    const questions = allFallbackQuestions();
    expect(questions.length).toBeGreaterThanOrEqual(21);
    expect(questions.every((q) => q.text.trim().length > 0)).toBe(true);
  });

  it("해결책 제안으로 오판되는 질문이 하나도 없다", () => {
    const rejected = allFallbackQuestions()
      .filter((q) => !checkNoSolution(q.text))
      .map((q) => `${q.stage}/${q.level}: ${q.text}`);

    expect(rejected).toEqual([]);
  });

  it("사실 창작으로 오판되는 질문이 하나도 없다", () => {
    // 사용자 입력이 비어 있는 최악의 조건으로 본다 — 질문에 숫자가 들어 있으면
    // 무조건 걸리는 상황이다. 규칙 기반 질문은 사용자 문장을 인용하지 않으므로
    // 어떤 입력에도 안전해야 한다.
    const rejected = allFallbackQuestions()
      .filter((q) => !checkNoFabricatedNumbers(q.text, ""))
      .map((q) => `${q.stage}/${q.level}: ${q.text}`);

    expect(rejected).toEqual([]);
  });
});
