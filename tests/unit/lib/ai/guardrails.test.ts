import { describe, expect, it } from "vitest";
import {
  runCoachGuardrails,
  runFeedbackGuardrails,
  checkNoSolution,
} from "@/lib/ai/guardrails";
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
  it("coachMessage에 물음표가 또 있으면 위반 — 질문 자리가 둘이 된다", () => {
    const result = runCoachGuardrails(MULTIPLE_QUESTIONS_OUTPUT, baseContext);
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("question_mark_in_message");
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
        {
          ...VALID_OUTPUT,
          action,
          question: null,
          coachMessage: "다음 단계로 넘어가도 좋아요.",
        },
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
    expect(result.violations).toContain("question_mark_in_message");
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
    const result = runCoachGuardrails(
      { ...VALID_OUTPUT, evidenceReferences: [] },
      baseContext,
    );
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
    expect(
      runFeedbackGuardrails(
        { ...validFeedback, nextQuestion: "이 부분을 점검해보세요." },
        userText,
      ).ok,
    ).toBe(true);
    expect(
      runFeedbackGuardrails(
        { ...validFeedback, nextQuestion: "이 가정을 검토해보세요." },
        userText,
      ).ok,
    ).toBe(true);
  });

  it("실제 해결책 제안('이렇게 해보세요')은 여전히 위반으로 잡는다", () => {
    const result = runFeedbackGuardrails(
      {
        ...validFeedback,
        improvementFocus: "다음부터는 회의 전에 미리 물어보는 방식을 도입해보세요.",
      },
      userText,
    );
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("solution_suggested");
  });
});

/**
 * 해결책 제안 검사(원칙 3)는 양방향으로 틀릴 수 있고, 두 방향의 대가가 다르다.
 *
 * - **오탐**(좋은 코칭을 거부): 사용자는 맞춤 질문 대신 규칙 기반 fallback을 받는다.
 *   조용히 매번 나빠지고, 화면에는 아무 이상도 보이지 않는다.
 * - **미탐**(해결책을 통과): AI가 문제를 대신 풀어준다. 이 앱이 하지 않겠다고 한 바로 그것.
 *
 * 예전 구현은 **둘 다** 틀렸다 — `~해 보세요`를 통째로 위반으로 보고 예외를 세 개만
 * 뒀기 때문에 이 앱의 코칭 어휘 대부분이 거부됐고, 정작 "담당자를 바꿔 보세요"는
 * `해`로 끝나지 않아 그대로 통과했다.
 */
describe("checkNoSolution — 코칭과 해결책을 가른다", () => {
  it.each([
    "한 번 더 확인해 보세요.",
    "두 문장을 비교해 보세요.",
    "사실과 해석을 구분해 보세요.",
    "무엇이 달라졌는지 정리해 보세요.",
    "그 장면을 다시 관찰해 보세요.",
    "스스로에게 질문해 보세요.",
    "왜 그렇게 생각했는지 설명해 보세요.",
    "그 순간을 조금 더 구체적으로 떠올려볼까요.",
    "어떤 근거가 있었는지 살펴 보세요.",
    "무엇이 사실인지 짚어 보세요.",
    "조금 더 들여다볼까요.",
    "다른 사례와 견줘 보세요.",
    "그 장면을 되돌아 보세요.",
    "무엇이 빠졌는지 뜯어 보세요.",
    "어떤 근거가 있는지 찾아 보세요.",
    "다른 관점을 탐색해 보세요.",
    "스스로에게 물어 보세요.",
    "본 것을 한 문장으로 적어주세요.",
    "그때 무슨 일이 있었는지 말씀해주세요.",
    "자신의 문장을 다시 읽어 보세요.",
    "어떤 점이 달랐는지 되짚어 볼까요.",
  ])("사고를 겨누는 권유는 통과한다: %s", (text) => {
    expect(checkNoSolution(text)).toBe(true);
  });

  it.each([
    "회의록 도구를 도입해 보세요.",
    "담당자를 바꿔 보세요.",
    "일정을 조정하면 됩니다.",
    "규칙을 문서로 만드세요.",
    "이렇게 해보세요.",
    "리마인더를 설정하시길 추천합니다.",
    "회의 시간을 늘리세요.",
    "알림을 켜세요.",
    "프로세스를 개선해 보세요.",
  ])("문제에 손대라는 권유는 막는다: %s", (text) => {
    expect(checkNoSolution(text)).toBe(false);
  });

  it("권유가 아예 없는 문장은 검사 대상이 아니다", () => {
    expect(checkNoSolution("그 장면에서 확인된 사실은 무엇인가요?")).toBe(true);
  });

  it("한 문장에 코칭과 해결책이 섞여 있으면 막는다", () => {
    // 앞의 코칭을 걷어내도 뒤의 해결책이 남는다 — 그걸 잡는 것이 이 구조의 핵심이다.
    expect(checkNoSolution("먼저 확인해 보세요. 그리고 담당자를 바꿔 보세요.")).toBe(
      false,
    );
  });
});

/**
 * 대필 검사(원칙 3의 나머지 절반 — "AI는 최종 문제 정의를 대신 만들지 않는다").
 *
 * 원래 패턴은 하나뿐이었고, 실제로 나올 법한 대필 문장 다섯 개 중 **하나만** 잡았다.
 * "당신의 문제 정의는 …입니다" 같은 노골적인 대필조차 통과했다 — 문장 틀이 조금만
 * 달라도 빠져나간다. 코칭은 묻고 대필은 단정한다는 차이를 표지로 잡는다.
 */
describe("checkNoGhostwriting — 정의를 대신 써주면 막는다", () => {
  const base = {
    currentStage: "definition" as const,
    action: "ask" as const,
    question: "지금 정의에서 확인된 사실은 무엇인가요?",
    detectedGaps: [],
    evidenceReferences: [],
    hintLevel: 0 as const,
    suggestedNextStage: null,
    safetyFlags: [],
  };
  const context = {
    currentStage: "definition" as const,
    userText: "회의 때마다 한 사람이 늦게 들어온다",
    recentQuestions: [],
  };
  const ghostwrote = (coachMessage: string) =>
    runCoachGuardrails({ ...base, coachMessage }, context).violations.includes(
      "ghostwriting",
    );

  it.each([
    "문제는 이렇게 정의할 수 있습니다: 승인 기준이 공유되지 않아 결과가 달라진다.",
    "정리하면, 팀은 채널 선택 기준이 없어서 응답이 지연되고 있습니다.",
    "주간 회의에서 실무자는 결정 권한이 없기 때문에 논의가 미뤄지는 문제를 겪고 있습니다.",
    "당신의 문제 정의는 기준 부재로 인한 결과 편차입니다.",
    "요약하면 승인 기준이 공유되지 않는 것이 문제입니다.",
  ])("정의를 단정하면 막는다: %s", (message) => {
    expect(ghostwrote(message)).toBe(true);
  });

  it.each([
    "지금 정의에서 확인된 사실이 잘 드러납니다.",
    "문제 정의를 다시 읽어 보세요.",
    "아직 확인되지 않은 부분이 남아 있습니다.",
    "정의에 사람과 상황이 함께 담기면 더 또렷해집니다.",
    "정리하면 무엇이 남나요?",
  ])("정의를 두고 논평하거나 묻는 것은 대필이 아니다: %s", (message) => {
    expect(ghostwrote(message)).toBe(false);
  });

  it("표지 없이 정의 문장만 내놓는 경우는 어휘로 구분할 수 없다 — 프롬프트가 맡는다", () => {
    // 같은 모양의 문장이 정당한 논평일 수도 있어서, 여기서 잡으면 좋은 응답까지 버린다.
    // 이 한계를 테스트로 적어둔다 — 나중에 "왜 안 잡히지"를 다시 조사하지 않도록.
    expect(
      ghostwrote("회의 시작 시각과 이동 동선이 맞지 않아 반복 지각이 발생하고 있다."),
    ).toBe(false);
  });

  it("정의·돌아보기 단계가 아니면 같은 문장이어도 대필이 아니다", () => {
    const atObservation = runCoachGuardrails(
      {
        ...base,
        currentStage: "observation",
        coachMessage: "당신의 문제 정의는 A입니다.",
      },
      { ...context, currentStage: "observation" },
    );
    expect(atObservation.violations).not.toContain("ghostwriting");
  });
});

/**
 * 원칙 2("AI는 한 번에 하나만 묻는다")는 이 앱에서 가장 두드러진 제약이다 —
 * 일반 AI 채팅과 방향이 반대라는 주장의 핵심이 여기 있다.
 *
 * 그런데 검사는 `coachMessage`의 물음표만 보고 있었다. 모델이 세 질문을 `question`
 * 한 필드에 담아 보내면 그대로 통과해서, 사용자는 한 번에 셋을 받는다.
 */
describe("checkSingleQuestion — 한 번에 하나만", () => {
  const base = {
    currentStage: "questioning" as const,
    action: "ask" as const,
    coachMessage: "조금 더 봅시다.",
    detectedGaps: [],
    evidenceReferences: [],
    hintLevel: 0 as const,
    suggestedNextStage: null,
    safetyFlags: [],
  };
  const context = {
    currentStage: "questioning" as const,
    userText: "회의 때마다 한 사람이 늦게 들어온다",
    recentQuestions: [],
  };
  const violations = (question: string) =>
    runCoachGuardrails({ ...base, question }, context).violations;

  it("질문 하나는 통과한다", () => {
    expect(violations("그때 무슨 일이 있었나요?")).not.toContain("multiple_questions");
  });

  it("물음표가 없어도 하나면 통과한다", () => {
    expect(violations("무엇이 달랐는지 한 문장으로 적어주세요.")).not.toContain(
      "multiple_questions",
    );
  });

  it.each([
    "언제였나요? 그리고 누가 함께 있었나요?",
    "언제였나요? 어디였나요? 누가 있었나요?",
  ])("question 필드에 질문이 여러 개면 막는다: %s", (question) => {
    expect(violations(question)).toContain("multiple_questions");
  });

  it("coachMessage에 물음표가 있으면 다른 코드로 막는다 — 원인이 다르면 고칠 곳도 다르다", () => {
    const result = runCoachGuardrails(
      { ...base, coachMessage: "그게 정말인가요?", question: "무엇이 달랐나요?" },
      context,
    );
    expect(result.violations).toContain("question_mark_in_message");
  });

  it("접속사로 이어붙인 두 질문은 세지 못한다 — 프롬프트가 맡는 경계다", () => {
    // 물음표가 하나뿐이라 어휘로는 구분할 수 없다. 한계를 적어둔다.
    expect(violations("왜 그렇게 보셨고, 무엇이 근거였나요?")).not.toContain(
      "multiple_questions",
    );
  });
});

/**
 * 반복 질문 검사. 원래는 완전히 같은 문장만 잡았고, 실제 제공자로 10번 재보니
 * 글자 몇 개만 다른 질문이 연달아 정상 응답으로 저장됐다 — 사용자 입장에서는 같은
 * 질문을 두 번 받은 것이다.
 */
describe("checkNotRepeated — 같은 질문을 두 번 주지 않는다", () => {
  const base = {
    currentStage: "questioning" as const,
    action: "ask" as const,
    coachMessage: "조금 더 봅시다.",
    detectedGaps: [],
    evidenceReferences: [],
    hintLevel: 0 as const,
    suggestedNextStage: null,
    safetyFlags: [],
  };
  const repeated = (question: string, recentQuestions: string[]) =>
    runCoachGuardrails(
      { ...base, question },
      {
        currentStage: "questioning",
        userText: "회의 때마다 한 사람이 늦게 들어온다",
        recentQuestions,
      },
    ).violations.includes("repeated_question");

  it("완전히 같은 질문은 막는다", () => {
    expect(repeated("그때 무슨 일이 있었나요?", ["그때 무슨 일이 있었나요?"])).toBe(true);
  });

  it("글자 몇 개만 다른 질문도 막는다 — 실제 제공자에서 나온 쌍이다", () => {
    const before = "지금 떠올리신 '이 사람'과 '늦는 상황'은 각각 무엇을 가리키나요?";
    const after = "지금 말씀하신 '이 사람'과 '늦는 상황'은 각각 무엇을 가리키나요?";
    expect(repeated(after, [before])).toBe(true);
  });

  it("서로 다른 질문은 통과한다", () => {
    expect(
      repeated("다른 사람에게 물어본다면 무엇을 먼저 묻고 싶나요?", [
        "이 사람이 늦는다고 느끼는 장면에서 다른 사람들은 어땠나요?",
      ]),
    ).toBe(false);
  });

  it("짧은 질문은 유사도를 믿지 않는다 — 한 글자 차이가 크게 흔들린다", () => {
    // "언제"와 "어디"는 명백히 다른 질문인데 유사도가 0.5까지 나온다.
    expect(repeated("그 장면은 어디였나요?", ["그 장면은 언제였나요?"])).toBe(false);
  });

  it("최근 질문이 없으면 무엇이든 통과한다", () => {
    expect(repeated("그때 무슨 일이 있었나요?", [])).toBe(false);
  });
});
