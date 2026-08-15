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

/**
 * 위 경로에서 사용자가 직접 확인하는 체크리스트 문항 (PRD §7.8 6개 평가 차원).
 * UI 문구지만 `lib/ai/`가 아니라 여기 둔다 — AI 판단이 아니라 이 요건 자체가 요구하는
 * 자기 점검 항목이고, `features/`가 `lib/ai/`를 직접 import하지 못하게 막은 레이어
 * 규칙(§4.1)을 우회하지 않기 위함이다. `STAGE_LABELS`(stages.ts)와 같은 이유의 선례다.
 */
export const SELF_CHECK_ITEMS = [
  { key: "observation_evidence", label: "실제 장면이나 확인된 사실에서 출발했나요?" },
  { key: "user_context", label: "누가 어떤 상황에서 겪는 문제인지 드러나나요?" },
  { key: "goal_barrier_impact", label: "원하는 것과 방해 요소, 결과가 구분되나요?" },
  { key: "fact_vs_hypothesis", label: "확인되지 않은 원인을 단정하지 않았나요?" },
  { key: "scope", label: "지나치게 넓거나 특정 해결책으로 고정되지 않았나요?" },
  { key: "next_exploration", label: "무엇을 더 확인해야 하는지 알 수 있나요?" },
] as const;

export type SelfCheckKey = (typeof SELF_CHECK_ITEMS)[number]["key"];

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

/**
 * User-first gate(CLAUDE.md §3 원칙 1)의 실제 판정. `checkStageRequirement`보다
 * 약한 기준이다 — "다음 단계로 넘어갈 만큼 충분한가"가 아니라 "이 단계에 사용자가
 * 뭐라도 썼는가"만 본다. AI 코칭(힌트·피드백) 호출 직전 서버가 이 함수로 403을
 * 판정한다(`app/api/sessions/[id]/coach`, `.../feedback`) — 빈 화면에 대고 AI를
 * 부르지 못하게 막는다.
 */
export function hasMinimalUserInput(stage: Stage, snapshot: TrainingSessionSnapshot): boolean {
  switch (stage) {
    case "not_started":
      return false;
    case "observation":
      return Boolean(snapshot.observation?.rawText.trim());
    case "separation":
      return snapshot.observationItems.length > 0;
    case "questioning":
      return snapshot.questions.some((q) => q.authorType === "user");
    case "exploration":
      return snapshot.stageResponses.some((r) => r.stage === "exploration" && !r.isDraft);
    case "reframing":
      return (
        snapshot.perspectives.some((p) => p.authorType === "user") ||
        snapshot.reframes.some((r) => r.authorType === "user")
      );
    case "definition":
    case "feedback":
      return snapshot.problemDefinitionVersions.some(
        (v) => v.versionNumber === 1 && v.authorType === "user",
      );
  }
}
