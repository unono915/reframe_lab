import { describe, expect, it } from "vitest";
import { runCoachGuardrails, runFeedbackGuardrails } from "@/lib/ai/guardrails";
import {
  FABRICATED_NUMBER_OUTPUT,
  GHOSTWRITING_OUTPUT,
  INVALID_NEXT_STAGE_OUTPUT,
  MULTIPLE_QUESTIONS_OUTPUT,
  REPEATED_QUESTION_OUTPUT,
  SOLUTION_SUGGESTED_OUTPUT,
  UNVERIFIED_EVIDENCE_OUTPUT,
  VALID_OUTPUT,
} from "../../../fixtures/ai/coach-outputs";

const baseContext = {
  currentStage: "observation" as const,
  userText: "회의에서 아무도 반대 의견을 내지 않았다",
  recentQuestions: ["이전에 이미 나온 질문"],
};

describe("runCoachGuardrails — 정상 응답", () => {
  it("모든 검사를 통과하면 ok: true를 반환한다", () => {
    const result = runCoachGuardrails(VALID_OUTPUT, baseContext);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });
});

describe("runCoachGuardrails — 위반 감지", () => {
  it("coachMessage에 물음표가 또 있으면 복수 질문 위반", () => {
    const result = runCoachGuardrails(MULTIPLE_QUESTIONS_OUTPUT, baseContext);
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("multiple_questions");
  });

  /**
   * 2026-09-01 실제 Upstage 응답에서 나온 형태다. action은 "ask"인데 question이 null이고
   * coachMessage에만 내용이 있었다. 기존 검사는 "question이 null이면 통과"라 이걸
   * 그대로 통과시켰고, Route Handler는 question만 돌려주므로 AI 호출은 소진됐는데
   * 힌트 버튼이 아무 반응 없이 끝났다 — 실패가 조용한 종류의 버그다.
   */
  it("action이 ask인데 질문이 없으면 위반 — 힌트 버튼이 침묵하면 안 된다", () => {
    const result = runCoachGuardrails(
      {
        ...VALID_OUTPUT,
        action: "ask",
        question: null,
        coachMessage: "세 질문 모두 회의의 흐름을 겨냥하고 있습니다.",
      },
      baseContext,
    );
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("missing_question");
  });

  it("공백뿐인 질문도 없는 것으로 본다", () => {
    const result = runCoachGuardrails(
      { ...VALID_OUTPUT, action: "ask", question: "   " },
      baseContext,
    );
    expect(result.violations).toContain("missing_question");
  });

  it("ask가 아닌 action은 질문이 없어도 정상이다", () => {
    // suggest_advance·feedback·fallback·safety는 물어볼 것이 없는 상태가 정상이다.
    for (const action of ["suggest_advance", "feedback", "fallback", "safety"] as const) {
      const result = runCoachGuardrails(
        { ...VALID_OUTPUT, action, question: null, coachMessage: "다음 단계로 넘어가도 좋아요." },
        baseContext,
      );
      expect(result.violations, action).not.toContain("missing_question");
    }
  });

  it("evidenceReferences가 사용자 입력에 없으면 근거 없음 위반", () => {
    const result = runCoachGuardrails(UNVERIFIED_EVIDENCE_OUTPUT, baseContext);
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("unverified_evidence");
  });

  it("사용자 입력에 없는 숫자가 등장하면 사실 창작 위반", () => {
    const result = runCoachGuardrails(FABRICATED_NUMBER_OUTPUT, baseContext);
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("fabricated_fact");
  });

  it("definition/feedback 단계에서 정의 문장 형태를 띠면 대필 위반", () => {
    const result = runCoachGuardrails(GHOSTWRITING_OUTPUT, {
      ...baseContext,
      currentStage: "definition",
    });
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("ghostwriting");
  });

  it("observation 등 다른 단계에서는 같은 문장이어도 대필 위반이 아니다", () => {
    const result = runCoachGuardrails(
      { ...GHOSTWRITING_OUTPUT, currentStage: "observation" },
      baseContext,
    );
    expect(result.violations).not.toContain("ghostwriting");
  });

  it("해결책 제안 패턴이 있으면 해결책 위반", () => {
    const result = runCoachGuardrails(SOLUTION_SUGGESTED_OUTPUT, baseContext);
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("solution_suggested");
  });

  it("suggestedNextStage가 바로 다음 단계가 아니면 단계 유효성 위반", () => {
    const result = runCoachGuardrails(INVALID_NEXT_STAGE_OUTPUT, baseContext);
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("invalid_next_stage");
  });

  it("suggestedNextStage가 실제 다음 단계면 통과한다", () => {
    const result = runCoachGuardrails(
      { ...VALID_OUTPUT, suggestedNextStage: "separation" },
      baseContext,
    );
    expect(result.violations).not.toContain("invalid_next_stage");
  });

  it("최근 질문과 완전히 같은 질문이면 반복 질문 위반", () => {
    const result = runCoachGuardrails(REPEATED_QUESTION_OUTPUT, baseContext);
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("repeated_question");
  });

  it("여러 위반이 동시에 있으면 전부 기록한다", () => {
    const result = runCoachGuardrails(
      { ...MULTIPLE_QUESTIONS_OUTPUT, evidenceReferences: ["없는 문구"] },
      baseContext,
    );
    expect(result.violations).toContain("multiple_questions");
    expect(result.violations).toContain("unverified_evidence");
  });
});

describe("runCoachGuardrails — 근거 필터링(부분 실패는 통과)", () => {
  it("일부 근거만 유효하면 무효한 것만 제거하고 통과시킨다", () => {
    const result = runCoachGuardrails(
      { ...VALID_OUTPUT, evidenceReferences: ["회의", "존재하지 않는 문구"] },
      baseContext,
    );
    expect(result.ok).toBe(true);
    expect(result.output.evidenceReferences).toEqual(["회의"]);
  });

  it("evidenceReferences가 원래 비어있으면 위반이 아니다", () => {
    const result = runCoachGuardrails({ ...VALID_OUTPUT, evidenceReferences: [] }, baseContext);
    expect(result.violations).not.toContain("unverified_evidence");
  });
});

describe("runFeedbackGuardrails", () => {
  const userText = "회의에서 아무도 반대 의견을 내지 않았다";
  const validFeedback = {
    dimensions: {},
    strength: '"회의에서 아무도 반대 의견을 내지 않았다"처럼 실제 문장에서 출발했어요.',
    improvementFocus: "다른 참석자의 입장도 확인해보면 좋겠어요.",
    unverifiedAssumption: "모든 참석자가 같은 이유로 침묵했다고 가정했을 수 있어요.",
    nextQuestion: "이 정의만 보고 다른 사람도 이해할 수 있을까요?",
  };

  it("정상 피드백은 통과한다", () => {
    expect(runFeedbackGuardrails(validFeedback, userText).ok).toBe(true);
  });

  it("사용자 입력에 없는 숫자가 있으면 위반", () => {
    const result = runFeedbackGuardrails(
      { ...validFeedback, strength: "지난 12번의 회의에서 반복됐다는 점이 좋아요." },
      userText,
    );
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("fabricated_fact");
  });

  it("해결책 제안 패턴이 있으면 위반", () => {
    const result = runFeedbackGuardrails(
      { ...validFeedback, improvementFocus: "회의 시간을 늘리면 됩니다." },
      userText,
    );
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("solution_suggested");
  });

  it("'확인해보세요'류 검증 요청은 해결책 제안이 아니다 (Mock Provider 실제 문구로 회귀 검증됨)", () => {
    const result = runFeedbackGuardrails(
      {
        ...validFeedback,
        unverifiedAssumption:
          "지금 든 원인이 유일한 원인이라고 단정하지 않았는지 확인해보세요.",
      },
      userText,
    );
    expect(result.ok).toBe(true);
    expect(result.violations).not.toContain("solution_suggested");
  });

  it("'점검해보세요'·'검토해보세요'도 해결책 제안이 아니다", () => {
    expect(runFeedbackGuardrails({ ...validFeedback, nextQuestion: "이 부분을 점검해보세요." }, userText).ok).toBe(true);
    expect(runFeedbackGuardrails({ ...validFeedback, nextQuestion: "이 가정을 검토해보세요." }, userText).ok).toBe(true);
  });

  it("실제 해결책 제안('이렇게 해보세요')은 여전히 위반으로 잡는다", () => {
    const result = runFeedbackGuardrails(
      { ...validFeedback, improvementFocus: "다음부터는 회의 전에 미리 물어보는 방식을 도입해보세요." },
      userText,
    );
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("solution_suggested");
  });
});
