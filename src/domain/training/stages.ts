import { STAGES, type Stage } from "@/domain/types";

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

export const TOTAL_ACTIVE_STAGES = STAGE_ORDER.length;
