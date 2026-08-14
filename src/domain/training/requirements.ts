import type { Stage, TrainingSessionSnapshot } from "@/domain/types";

/**
 * 단계별 예외 진행에 쓰는 예약 StageResponse.promptKey (DEVELOPMENT_PLAN.md §7.2 "예외 허용" 열).
 * 별도 Entity를 새로 만들지 않고 이미 있는 StageResponse에 정해진 promptKey로 기록한다 —
 * 사유가 그대로 감사 로그(createdAt 포함)가 된다는 뜻이다.
 */
export const EXCEPTION_PROMPT_KEYS = {
  observation: "observation_limit_reason",
  separation: "insufficient_facts_reason",
  questioning: "questioning_exception_reason",
  reframing: "reframe_exception_reason",
} as const;

/** exploration 단계 필수 4종 (PRD §8, DEVELOPMENT_PLAN.md §7.2). */
export const EXPLORATION_REQUIRED_PROMPT_KEYS = [
  "affected_user",
  "context",
  "impact",
  "unknown",
] as const;

/** feedback 단계에서 AI 장애 시 대체 경로 (PRD §7.12, §12.2 표 feedback 행). */
export const FEEDBACK_SELF_CHECK_PROMPT_KEY = "self_checklist_completed";

export interface RequirementCheck {
  met: boolean;
  /** 최소 기준이 아니라 예외 경로로 통과했는지. UI가 "예외로 진행했음"을 표시하는 데 쓴다. */
  viaException: boolean;
}

function notMet(): RequirementCheck {
  return { met: false, viaException: false };
}

function metNormally(): RequirementCheck {
  return { met: true, viaException: false };
}

function metByException(): RequirementCheck {
  return { met: true, viaException: true };
}

function findStageResponse(
  snapshot: TrainingSessionSnapshot,
  stage: Stage,
  promptKey: string,
): string | undefined {
  const response = snapshot.stageResponses.find(
    (r) => r.stage === stage && r.promptKey === promptKey && !r.isDraft,
  );
  return response?.content.trim() ? response.content.trim() : undefined;
}

function checkObservation(snapshot: TrainingSessionSnapshot): RequirementCheck {
  if (snapshot.observation && snapshot.observation.rawText.trim().length > 0) {
    return metNormally();
  }
  if (findStageResponse(snapshot, "observation", EXCEPTION_PROMPT_KEYS.observation)) {
    return metByException();
  }
  return notMet();
}

function checkSeparation(snapshot: TrainingSessionSnapshot): RequirementCheck {
  if (snapshot.observationItems.some((item) => item.userConfirmed)) {
    return metNormally();
  }
  if (findStageResponse(snapshot, "separation", EXCEPTION_PROMPT_KEYS.separation)) {
    return metByException();
  }
  return notMet();
}

function checkQuestioning(snapshot: TrainingSessionSnapshot): RequirementCheck {
  const userQuestions = snapshot.questions.filter((q) => q.authorType === "user");
  const hasPriorityWithReason = snapshot.questions.some(
    (q) => q.isPriority && Boolean(q.priorityReason?.trim()),
  );
  if (userQuestions.length >= 3 && hasPriorityWithReason) {
    return metNormally();
  }

  const reachedHintLevel2 = snapshot.questions.some((q) => q.hintLevelUsed >= 2);
  const exceptionAck = findStageResponse(
    snapshot,
    "questioning",
    EXCEPTION_PROMPT_KEYS.questioning,
  );
  if (userQuestions.length >= 1 && reachedHintLevel2 && exceptionAck) {
    return metByException();
  }
  return notMet();
}

function checkExploration(snapshot: TrainingSessionSnapshot): RequirementCheck {
  const allAnswered = EXPLORATION_REQUIRED_PROMPT_KEYS.every((key) =>
    findStageResponse(snapshot, "exploration", key),
  );
  return allAnswered ? metNormally() : notMet();
}

function checkReframing(snapshot: TrainingSessionSnapshot): RequirementCheck {
  const userReframes = snapshot.reframes.filter((r) => r.authorType === "user");
  if (userReframes.length >= 2) {
    return metNormally();
  }
  const exceptionAck = findStageResponse(
    snapshot,
    "reframing",
    EXCEPTION_PROMPT_KEYS.reframing,
  );
  if (userReframes.length >= 1 && exceptionAck) {
    return metByException();
  }
  return notMet();
}

function checkDefinition(snapshot: TrainingSessionSnapshot): RequirementCheck {
  // "이 조건은 타협하지 않는다" (DEVELOPMENT_PLAN.md §7.2) — 예외 경로 없음.
  const hasV1 = snapshot.problemDefinitionVersions.some(
    (v) => v.versionNumber === 1 && v.authorType === "user",
  );
  return hasV1 ? metNormally() : notMet();
}

function checkFeedback(snapshot: TrainingSessionSnapshot): RequirementCheck {
  const latestVersion = snapshot.problemDefinitionVersions.reduce<number>(
    (max, v) => Math.max(max, v.versionNumber),
    0,
  );
  const hasFreshFeedback = snapshot.aiFeedbacks.some(
    (f) =>
      !f.isStale &&
      snapshot.problemDefinitionVersions.find(
        (v) => v.id === f.problemDefinitionVersionId,
      )?.versionNumber === latestVersion,
  );
  if (hasFreshFeedback) return metNormally();

  const selfCheckDone = findStageResponse(
    snapshot,
    "feedback",
    FEEDBACK_SELF_CHECK_PROMPT_KEY,
  );
  // AI 피드백이 없을 때만 체크리스트 경로가 "예외"다. AI가 살아있는데 체크리스트로
  // 우회하는 것은 허용하지 않는다 — PRD §7.12 "AI 장애 시 체크리스트 경로 필수".
  return selfCheckDone ? metByException() : notMet();
}

const CHECKERS: Record<
  Exclude<Stage, "not_started">,
  (snapshot: TrainingSessionSnapshot) => RequirementCheck
> = {
  observation: checkObservation,
  separation: checkSeparation,
  questioning: checkQuestioning,
  exploration: checkExploration,
  reframing: checkReframing,
  definition: checkDefinition,
  feedback: checkFeedback,
};

/**
 * 현재 stage의 산출물이 다음 단계로 넘어갈 만큼 충분한지 검사한다.
 * `not_started`는 데이터 조건이 없다 — 사용자의 '시작' 행동 자체가 전환 트리거다.
 */
export function checkStageRequirement(
  stage: Stage,
  snapshot: TrainingSessionSnapshot,
): RequirementCheck {
  if (stage === "not_started") return metNormally();
  return CHECKERS[stage](snapshot);
}
