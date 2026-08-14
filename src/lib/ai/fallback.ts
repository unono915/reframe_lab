import type { HintLevel, Stage } from "@/domain/types";

/**
 * 규칙 기반 질문 은행 + 자기 점검 체크리스트. AI 호출 없이도 세션을 완주할 수 있게
 * 하는 실제 구현체다(PRD §7.10 Fallback path, §7.12). `providers/mock.ts`가 이 은행을
 * 감싸 Structured Output 형태로 반환한다 — 질문 내용 자체는 여기 한 곳에만 있다.
 *
 * 힌트 Level(0~2)이 그대로 배열 인덱스가 된다: Level 0=질문만, Level 1=관찰 렌즈를 곁들인
 * 질문, Level 2=더 구체적인 선택지형 질문(PRD §7.6).
 */
const STAGE_QUESTION_BANK: Record<
  Exclude<Stage, "not_started">,
  [string, string, string]
> = {
  observation: [
    "이 장면을 실제로 본 시간과 장소는 어디였나요?",
    "그 장면에서 구체적으로 누가, 무엇을 했나요?",
    "예를 들어 하나만 더 적어본다면 어떤 순간일까요?",
  ],
  separation: [
    "이 문장은 눈으로 확인한 사실인가요, 그렇게 해석한 것인가요?",
    "다른 사람이 봐도 똑같이 동의할 만한 부분은 어디인가요?",
    "'항상', '늘' 같은 표현 대신 실제로 몇 번 있었는지 말할 수 있나요?",
  ],
  questioning: [
    "지금 떠오른 질문 중, 답을 알면 가장 크게 달라질 질문은 무엇인가요?",
    "다른 사람에게 물어본다면 무엇을 먼저 묻고 싶나요?",
    "'왜'로 시작하는 질문을 하나 더 만들 수 있을까요?",
  ],
  exploration: [
    "이 상황에서 가장 직접적인 영향을 받는 사람은 누구인가요?",
    "지금 확실히 알지 못하는 부분은 무엇인가요?",
    "이 문제가 없었던 순간이 있었다면 무엇이 달랐나요?",
  ],
  reframing: [
    "이 문제를 다른 사람의 입장에서 본다면 어떻게 보일까요?",
    "시간을 더 앞이나 뒤로 옮겨서 본다면 무엇이 달라 보이나요?",
    "범위를 더 넓히거나 좁혀서 본다면 어떤 문제로 보이나요?",
  ],
  definition: [
    "지금 쓴 문장에서 '누가', '무엇을', '왜'가 모두 드러나 있나요?",
    "이 정의만 보고 다른 사람이 상황을 이해할 수 있을까요?",
    "해결책이 아니라 문제 자체를 설명하고 있나요?",
  ],
  feedback: [
    "처음 생각과 비교해 무엇이 달라졌나요?",
    "아직 확인하지 못한 가정은 무엇인가요?",
    "다음에 이 문제를 다시 본다면 무엇부터 확인하고 싶나요?",
  ],
};

export function getFallbackQuestion(stage: Stage, hintLevel: HintLevel): string {
  const bank =
    stage === "not_started"
      ? STAGE_QUESTION_BANK.observation
      : STAGE_QUESTION_BANK[stage];
  return bank[hintLevel];
}

/** feedback 단계에서 AI 없이 완료하는 자기 점검 체크리스트 (PRD §7.8 6개 차원). */
export const SELF_CHECK_ITEMS = [
  { key: "observation_evidence", label: "실제 장면이나 확인된 사실에서 출발했나요?" },
  { key: "user_context", label: "누가 어떤 상황에서 겪는 문제인지 드러나나요?" },
  { key: "goal_barrier_impact", label: "원하는 것과 방해 요소, 결과가 구분되나요?" },
  { key: "fact_vs_hypothesis", label: "확인되지 않은 원인을 단정하지 않았나요?" },
  { key: "scope", label: "지나치게 넓거나 특정 해결책으로 고정되지 않았나요?" },
  { key: "next_exploration", label: "무엇을 더 확인해야 하는지 알 수 있나요?" },
] as const;

export type SelfCheckKey = (typeof SELF_CHECK_ITEMS)[number]["key"];
