import type { Stage, TrainingSessionSnapshot } from "@/domain/types";
import { checkStageRequirement } from "./requirements";
import { STAGE_ORDER } from "./stages";

/**
 * PRD §6.3의 7개 완료 조건은 각 단계의 종료 조건(§7.2)을 순서대로 통과하는 것과 같다 —
 * `state-machine.ts`의 `advanceStage`가 `feedback → completed`에 도달했다면 이미 전부
 * 충족된 것이다. 이 파일은 완료 여부의 별도 재판정이 아니라, "예외로 통과한 단계가
 * 있었는가"를 드러내는 요약을 만든다 — 사용자를 실패 처리하지 않되 예외 사용은 기록해야
 * 한다는 원칙(PRD §6.3, CLAUDE.md 작업 원칙)의 구현이다.
 */
export interface CompletionSummary {
  completed: boolean;
  /** 예외 경로로 통과한 단계 목록. 비어 있으면 전 단계를 기준대로 완료한 것이다. */
  stagesPassedByException: Stage[];
}

export function isSessionComplete(snapshot: TrainingSessionSnapshot): boolean {
  return snapshot.session.status === "completed";
}

export function summarizeCompletion(
  snapshot: TrainingSessionSnapshot,
): CompletionSummary {
  const stagesPassedByException = STAGE_ORDER.filter((stage) => {
    const check = checkStageRequirement(stage, snapshot);
    return check.met && check.viaException;
  });

  return {
    completed: isSessionComplete(snapshot),
    stagesPassedByException,
  };
}
