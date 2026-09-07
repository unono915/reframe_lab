import { describe, expect, it } from "vitest";
import { buildCoachContext } from "@/lib/ai/context";
import { runCoachGuardrails } from "@/lib/ai/guardrails";
import { PROMPT_INJECTION_USER_TEXT, VALID_OUTPUT } from "../../../fixtures/ai/coach-outputs";
import {
  makeCoachInteraction,
  makeObservation,
  makeObservationItem,
  makePerspective,
  makeProblemDefinitionVersion,
  makeQuestion,
  makeReframe,
  makeSnapshot,
  makeStageResponse,
} from "../../domain/training/fixtures";

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

/**
 * 단계별 추출 규칙. 여기서 고르는 문자열이 곧 **AI가 볼 수 있는 전부**라,
 * 이 함수는 개발 원칙 여러 개가 실제로 구현되는 자리다:
 *
 * - 원칙 1(사용자가 먼저 쓴다) — 사용자가 쓰지 않은 것은 userText에 들어가면 안 된다.
 * - 원칙 5(Evidence boundary) — AI가 만든 문장이 userText에 섞이면, Guardrail의
 *   근거 검사가 **AI 자신의 말을 사용자 근거로 인정**하게 되어 경계가 무너진다.
 * - 원칙 6(author_type) — 그 구분이 실제로 필터로 쓰이는지 확인한다.
 *
 * 커버리지 28%였던 파일이라(2026-09-08) 7개 분기를 모두 짚는다.
 */
describe("buildCoachContext — 단계별로 그 단계의 사용자 입력만 담는다", () => {
  it("observation: 관찰 원문", () => {
    const snapshot = makeSnapshot({ observation: makeObservation({ rawText: "관찰한 장면" }) });
    expect(buildCoachContext("observation", snapshot, 0).userText).toBe("관찰한 장면");
  });

  it("observation: 아직 안 썼으면 빈 문자열 — 없는 내용을 지어내지 않는다", () => {
    expect(buildCoachContext("observation", makeSnapshot(), 0).userText).toBe("");
  });

  it("separation: 사용자가 확인한 항목만, 분류를 붙여서", () => {
    const snapshot = makeSnapshot({
      observationItems: [
        makeObservationItem({ text: "확인된 사실", type: "fact", userConfirmed: true }),
        // AI가 제안했지만 사용자가 아직 확인하지 않은 항목 — 사용자 입력이 아니다.
        makeObservationItem({ text: "미확인 제안", type: "interpretation", userConfirmed: false }),
      ],
    });
    const { userText } = buildCoachContext("separation", snapshot, 0);
    expect(userText).toBe("[fact] 확인된 사실");
    expect(userText).not.toContain("미확인 제안");
  });

  it("questioning: 사용자가 쓴 질문만 — AI가 만든 질문은 제외한다", () => {
    const snapshot = makeSnapshot({
      questions: [
        makeQuestion({ text: "내가 쓴 질문", authorType: "user" }),
        makeQuestion({ text: "코치가 준 질문", authorType: "ai" }),
      ],
    });
    const { userText } = buildCoachContext("questioning", snapshot, 0);
    expect(userText).toBe("내가 쓴 질문");
    expect(userText).not.toContain("코치가 준 질문");
  });

  it("exploration: 확정된 응답만 — 작성 중 초안은 보내지 않는다", () => {
    const snapshot = makeSnapshot({
      stageResponses: [
        makeStageResponse({ stage: "exploration", promptKey: "context", content: "확정 답변", isDraft: false }),
        makeStageResponse({ stage: "exploration", promptKey: "impact", content: "쓰다 만 초안", isDraft: true }),
        // 다른 단계의 응답이 섞이면 안 된다.
        makeStageResponse({ stage: "feedback", promptKey: "other", content: "다른 단계 응답", isDraft: false }),
      ],
    });
    const { userText } = buildCoachContext("exploration", snapshot, 0);
    expect(userText).toBe("[context] 확정 답변");
    expect(userText).not.toContain("쓰다 만 초안");
    expect(userText).not.toContain("다른 단계 응답");
  });

  it("reframing: 사용자가 쓴 관점과 프레임을 함께, AI 작성분은 빼고", () => {
    const snapshot = makeSnapshot({
      perspectives: [
        makePerspective({ content: "내 관점", authorType: "user" }),
        makePerspective({ content: "AI 관점", authorType: "ai" }),
      ],
      reframes: [
        makeReframe({ text: "내 프레임", authorType: "user" }),
        makeReframe({ text: "AI 프레임", authorType: "ai" }),
      ],
    });
    const { userText } = buildCoachContext("reframing", snapshot, 0);
    expect(userText).toBe("내 관점\n내 프레임");
  });

  it("definition·feedback: 배열 순서가 아니라 versionNumber가 가장 큰 정의", () => {
    const snapshot = makeSnapshot({
      problemDefinitionVersions: [
        makeProblemDefinitionVersion({ versionNumber: 2, text: "고쳐 쓴 정의" }),
        makeProblemDefinitionVersion({ versionNumber: 1, text: "처음 정의" }),
      ],
    });
    expect(buildCoachContext("definition", snapshot, 0).userText).toBe("고쳐 쓴 정의");
    expect(buildCoachContext("feedback", snapshot, 0).userText).toBe("고쳐 쓴 정의");
  });

  it("hintLevel은 그대로 전달된다", () => {
    expect(buildCoachContext("observation", makeSnapshot(), 2).hintLevel).toBe(2);
  });
});

describe("buildCoachContext — 반복 질문 검사용 최근 질문", () => {
  function coachAsked(stage: Parameters<typeof buildCoachContext>[0], question: string, isStale = false) {
    return makeCoachInteraction({ stage, isStale, validatedOutput: { question } });
  }

  it("같은 단계의 최근 질문만 모은다", () => {
    const snapshot = makeSnapshot({
      coachInteractions: [
        coachAsked("questioning", "질문 단계에서 물었던 것"),
        coachAsked("exploration", "다른 단계에서 물었던 것"),
      ],
    });
    expect(buildCoachContext("questioning", snapshot, 0).recentQuestions).toEqual([
      "질문 단계에서 물었던 것",
    ]);
  });

  it("stale 처리된 상호작용은 제외한다 — 사용자가 앞 단계를 고쳐 무효가 된 질문이다", () => {
    const snapshot = makeSnapshot({
      coachInteractions: [coachAsked("questioning", "무효가 된 질문", true)],
    });
    expect(buildCoachContext("questioning", snapshot, 0).recentQuestions).toEqual([]);
  });

  it("최근 2개까지만 보낸다 — 프롬프트에 옛 질문을 계속 쌓지 않는다", () => {
    const snapshot = makeSnapshot({
      coachInteractions: [
        coachAsked("questioning", "첫 번째"),
        coachAsked("questioning", "두 번째"),
        coachAsked("questioning", "세 번째"),
      ],
    });
    expect(buildCoachContext("questioning", snapshot, 0).recentQuestions).toEqual([
      "두 번째",
      "세 번째",
    ]);
  });

  it("질문이 비어 있던 상호작용은 걸러낸다", () => {
    const snapshot = makeSnapshot({
      coachInteractions: [
        makeCoachInteraction({ stage: "questioning", validatedOutput: { question: null } }),
        coachAsked("questioning", "실제 질문"),
      ],
    });
    expect(buildCoachContext("questioning", snapshot, 0).recentQuestions).toEqual(["실제 질문"]);
  });
});
