import { describe, expect, it } from "vitest";
import { buildCoachContext } from "@/lib/ai/context";
import { runCoachGuardrails } from "@/lib/ai/guardrails";
import { PROMPT_INJECTION_USER_TEXT, VALID_OUTPUT } from "../../../fixtures/ai/coach-outputs";
import { makeObservation, makeQuestion, makeSnapshot } from "../../domain/training/fixtures";

/**
 * 프롬프트 주입 회귀 테스트 (DEVELOPMENT_PLAN.md §8.4 "프롬프트 주입 문구가 시스템
 * 명령으로 처리되지 않음"). Mock Provider는 userText 내용을 아예 읽지 않고 stage·
 * hintLevel만으로 결정론적 질문을 고르므로, 이 파일은 그 경계를 "구조적으로" 검증한다:
 * 사용자가 입력한 지시문처럼 보이는 문자열이 context.userText에 원문 그대로만
 * 담기고(해석·실행되지 않고), Guardrail이 이를 여느 사용자 텍스트와 동일한 규칙으로만
 * 평가한다는 것을 확인한다.
 */
describe("buildCoachContext — 프롬프트 주입 격리", () => {
  it("사용자 입력에 담긴 지시문처럼 보이는 문구를 그대로 데이터로만 담는다", () => {
    const snapshot = makeSnapshot({
      observation: makeObservation({ rawText: PROMPT_INJECTION_USER_TEXT }),
    });
    const context = buildCoachContext("observation", snapshot, 0);
    expect(context.userText).toBe(PROMPT_INJECTION_USER_TEXT);
  });

  it("질문 단계에서도 주입 문구가 그대로 데이터로만 담긴다", () => {
    const snapshot = makeSnapshot({
      questions: [makeQuestion({ text: PROMPT_INJECTION_USER_TEXT, authorType: "user" })],
    });
    const context = buildCoachContext("questioning", snapshot, 0);
    expect(context.userText).toBe(PROMPT_INJECTION_USER_TEXT);
  });
});

describe("runCoachGuardrails — 프롬프트 주입 문구는 특별 취급되지 않는다", () => {
  it("정상 출력이 evidenceReferences에 주입 문구를 인용해도 일반 근거 검사만 적용된다", () => {
    const context = {
      currentStage: "observation" as const,
      userText: PROMPT_INJECTION_USER_TEXT,
      recentQuestions: [] as string[],
    };
    const output = { ...VALID_OUTPUT, evidenceReferences: [PROMPT_INJECTION_USER_TEXT] };
    const result = runCoachGuardrails(output, context);
    // 주입 문구가 사용자 입력에 실제로 존재하므로, "명령"이 아니라 그냥 참조 가능한
    // 문자열로 취급되어 근거 검사를 통과한다 — 시스템이 그 내용을 명령으로 실행하지
    // 않는다는 것이 이 통과 자체로 증명된다(실행됐다면애초에 이 경로에 도달하지 못함).
    expect(result.ok).toBe(true);
    expect(result.output.evidenceReferences).toEqual([PROMPT_INJECTION_USER_TEXT]);
  });

  it("주입 문구가 사용자 입력에 없는데 근거로 인용되면 여전히 위반으로 잡힌다", () => {
    const context = {
      currentStage: "observation" as const,
      userText: "회의에서 아무도 반대 의견을 내지 않았다",
      recentQuestions: [] as string[],
    };
    const output = { ...VALID_OUTPUT, evidenceReferences: [PROMPT_INJECTION_USER_TEXT] };
    const result = runCoachGuardrails(output, context);
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("unverified_evidence");
  });
});
