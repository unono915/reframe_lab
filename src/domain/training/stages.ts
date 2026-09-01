import { STAGES, type SessionStatus, type Stage } from "@/domain/types";

/**
 * 활성 단계만의 순서(not_started 제외). 상태 전환·stale 전파 계산의 기준 인덱스다.
 * PRD §12.1 상태 열거를 권위로 삼는다 — §8 서술의 "관점 확장"·"재정의"는 `reframing`
 * 하나의 UI Microstep 2개로 흡수한다 (DEVELOPMENT_PLAN.md §7.2 설계 결정).
 */
export const STAGE_ORDER: readonly Exclude<Stage, "not_started">[] = STAGES.filter(
  (stage): stage is Exclude<Stage, "not_started"> => stage !== "not_started",
);

export function stageIndex(stage: Stage): number {
  if (stage === "not_started") return -1;
  return STAGE_ORDER.indexOf(stage);
}

/** stage a가 stage b보다 앞선 단계인지. not_started는 모든 단계보다 앞선다. */
export function isBeforeStage(a: Stage, b: Stage): boolean {
  return stageIndex(a) < stageIndex(b);
}

export function nextStageOf(stage: Stage): Stage | null {
  if (stage === "not_started") return STAGE_ORDER[0] ?? null;
  const idx = stageIndex(stage);
  return STAGE_ORDER[idx + 1] ?? null;
}

/**
 * 사용자 노출 Label ↔ 내부 상태 id 매핑. DESIGN.md §9.12가 정본이며, 화면·Prompt에
 * 이 문자열을 직접 새로 쓰지 않고 반드시 이 맵을 통해서만 참조한다.
 */
export const STAGE_LABELS: Record<Exclude<Stage, "not_started">, string> = {
  observation: "관찰",
  separation: "구분",
  questioning: "질문",
  exploration: "탐색",
  reframing: "재정의",
  definition: "정의",
  feedback: "돌아보기",
};

export function stageLabel(stage: Stage): string {
  if (stage === "not_started") return "시작 전";
  return STAGE_LABELS[stage];
}

/**
 * 단계별 "왜 이걸 하나요" 한 줄 (RESEARCH_VALIDATION.md §5 P0-3).
 *
 * 왜 필요한가 — 기존 앱은 개념 설명이 전혀 없는 몰입형(immersion)이었다. 사용자는
 * 사실/해석/가정을 배운 적 없이 분류하도록 요구받았다. 비판적 사고 교수법 메타분석은
 * 명시적 교육이 몰입형보다 효과가 크다고 보고하고, 고착(Einstellung) 연구는 **편향의
 * 존재를 알려주기만 해도** 고착이 유의하게 줄어든다고 보고한다.
 *
 * 강의가 아니라 **필요한 순간의 한 줄**이라는 점이 중요하다 — 기본은 접혀 있고,
 * 각 문장은 원리(mechanism)를 말하되 전문 용어를 쓰지 않는다. 답을 알려주는 것이
 * 아니므로 원칙 3(AI가 대신 정의하지 않는다)과 무관하다. 이 문장들은 AI가 생성하지
 * 않는 `system_template` 성격의 고정 문구다.
 *
 * `STAGE_LABELS`와 같은 이유로 여기 둔다 — 화면이 이 문자열을 직접 새로 쓰지 않는다.
 */
export const STAGE_RATIONALE: Record<Exclude<Stage, "not_started">, string> = {
  observation:
    "'불편하다'만으로는 확인할 수 없어요. 실제 장면으로 바꾸면 따져볼 수 있는 것이 생겨요.",
  separation:
    "사실은 카메라에 찍히는 것, 해석은 내가 붙인 의미예요. 섞여 있으면 해석을 사실로 믿게 돼요.",
  questioning:
    "답을 먼저 찾으면 처음 떠오른 답에 갇혀요. 질문을 여러 개 만들어두면 고를 수 있어요.",
  exploration:
    "누가 어떤 상황에서 겪는지가 빠지면, 나에게만 문제인 것을 모두의 문제로 쓰게 돼요.",
  reframing:
    "사람은 처음 떠올린 틀에 고정되는 경향이 있어요. 그래서 일부러 다른 틀을 더 써봐요.",
  definition:
    "좋은 정의는 멋진 문장이 아니라 누가·무엇을·왜가 드러난 문장이에요.",
  feedback:
    "무엇이 왜 달라졌는지 스스로 설명할 때 생각이 가장 오래 남아요.",
};

export function stageRationale(stage: Stage): string | null {
  if (stage === "not_started") return null;
  return STAGE_RATIONALE[stage];
}

export const TOTAL_ACTIVE_STAGES = STAGE_ORDER.length;

/**
 * History·Result 등 세션 목록에 노출하는 상태 Label. `stageLabel`과 마찬가지로
 * 이 맵을 통해서만 참조한다 — 완료 조건 "연속 기록이 끊겨도 비난·실패 표현 없음"에
 * 맞춰 "포기"·"실패" 같은 단정적 표현 대신 담담한 표현을 쓴다.
 */
export function sessionStatusLabel(status: SessionStatus): string {
  switch (status) {
    case "completed":
      return "완료";
    case "paused":
      return "보류 중";
    case "abandoned":
      return "중단됨";
    default:
      return `진행 중 · ${stageLabel(status)}`;
  }
}
