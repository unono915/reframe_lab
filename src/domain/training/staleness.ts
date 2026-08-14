import type {
  AIFeedback,
  CoachInteraction,
  Stage,
  TrainingSessionSnapshot,
} from "@/domain/types";
import { nextStageOf, stageIndex } from "./stages";

export interface StaleComputation {
  staleCoachInteractionIds: string[];
  staleAiFeedbackIds: string[];
}

/**
 * 이전 단계 수정 시 무효화 범위 계산 (DEVELOPMENT_PLAN.md §7.4 표 그대로).
 *
 * `coach_interactions`는 자체 `stage`를 가지므로 "threshold 단계 이후 전부"를 인덱스
 * 비교로 바로 계산할 수 있다. `ai_feedbacks`는 stage가 없고 `definition` 단계 이후에만
 * 존재하므로 두 갈래로 나눈다: (1) definition보다 앞선 단계를 고쳤다면 존재하는 모든
 * 피드백이 stale, (2) definition 자체를 고쳤다면(새 버전 작성) "그 버전을 참조하는"
 * 피드백만 stale — 즉 최신 버전보다 낮은 버전을 참조하는 피드백.
 *
 * 보존 원칙: 이 함수는 무엇이 stale "이어야 하는지"만 계산한다. 사용자 원문과 이전
 * 버전을 지우지 않는다 — 호출자가 `isStale` 플래그만 갱신한다.
 */
export function computeStaleArtifacts(
  editedStage: Stage,
  snapshot: TrainingSessionSnapshot,
): StaleComputation {
  const thresholdStage = nextStageOf(editedStage);
  if (!thresholdStage) {
    return { staleCoachInteractionIds: [], staleAiFeedbackIds: [] };
  }
  const thresholdIndex = stageIndex(thresholdStage);
  const definitionIndex = stageIndex("definition");

  const staleCoachInteractionIds = snapshot.coachInteractions
    .filter((ci) => !ci.isStale && stageIndex(ci.stage) >= thresholdIndex)
    .map((ci) => ci.id);

  let staleAiFeedbackIds: string[];
  if (editedStage === "definition") {
    const latestVersion = snapshot.problemDefinitionVersions.reduce(
      (max, v) => Math.max(max, v.versionNumber),
      0,
    );
    staleAiFeedbackIds = snapshot.aiFeedbacks
      .filter((f) => !f.isStale)
      .filter((f) => {
        const version = snapshot.problemDefinitionVersions.find(
          (v) => v.id === f.problemDefinitionVersionId,
        );
        return version !== undefined && version.versionNumber < latestVersion;
      })
      .map((f) => f.id);
  } else if (thresholdIndex <= definitionIndex) {
    staleAiFeedbackIds = snapshot.aiFeedbacks.filter((f) => !f.isStale).map((f) => f.id);
  } else {
    staleAiFeedbackIds = [];
  }

  return { staleCoachInteractionIds, staleAiFeedbackIds };
}

/**
 * 계산된 stale ID를 실제로 반영한 새 배열을 만든다(순수 함수, 원본 불변).
 * 집계 원칙: stale 피드백/코칭은 Growth 지표와 최종 결과에서 유효한 것으로 세지 않는다 —
 * 이 값을 걸러내는 책임은 집계 함수(domain/growth) 쪽에 있고, 여기서는 플래그만 세운다.
 */
export function applyStaleness(
  snapshot: TrainingSessionSnapshot,
  { staleCoachInteractionIds, staleAiFeedbackIds }: StaleComputation,
): Pick<TrainingSessionSnapshot, "coachInteractions" | "aiFeedbacks"> {
  const staleCoachSet = new Set(staleCoachInteractionIds);
  const staleFeedbackSet = new Set(staleAiFeedbackIds);

  const coachInteractions: CoachInteraction[] = snapshot.coachInteractions.map((ci) =>
    staleCoachSet.has(ci.id) ? { ...ci, isStale: true } : ci,
  );
  const aiFeedbacks: AIFeedback[] = snapshot.aiFeedbacks.map((f) =>
    staleFeedbackSet.has(f.id) ? { ...f, isStale: true } : f,
  );

  return { coachInteractions, aiFeedbacks };
}
