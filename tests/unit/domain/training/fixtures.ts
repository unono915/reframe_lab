import type {
  AIFeedback,
  CoachInteraction,
  Observation,
  ObservationItem,
  Perspective,
  ProblemDefinitionVersion,
  Question,
  Reframe,
  Stage,
  StageResponse,
  TrainingSession,
  TrainingSessionSnapshot,
} from "@/domain/types";

let idCounter = 0;
function id(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  const now = new Date().toISOString();
  return {
    id: id("session"),
    clientGeneratedId: id("client"),
    userId: "user-1",
    templateId: "template-1",
    trainingDate: "2026-08-15",
    timezone: "Asia/Seoul",
    status: "observation",
    currentStage: "observation",
    lastActiveStage: null,
    stateVersion: 0,
    aiCallCount: 0,
    startedAt: now,
    lastActiveAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeSnapshot(
  overrides: Partial<TrainingSessionSnapshot> = {},
): TrainingSessionSnapshot {
  return {
    session: makeSession(),
    observation: null,
    observationItems: [],
    stageResponses: [],
    questions: [],
    perspectives: [],
    reframes: [],
    problemDefinitionVersions: [],
    aiFeedbacks: [],
    coachInteractions: [],
    ...overrides,
  };
}

export function makeObservation(overrides: Partial<Observation> = {}): Observation {
  const now = new Date().toISOString();
  return {
    id: id("obs"),
    sessionId: "session-1",
    rawText: "회의 때마다 같은 사람이 늦게 들어온다",
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeObservationItem(
  overrides: Partial<ObservationItem> = {},
): ObservationItem {
  return {
    id: id("item"),
    observationId: "obs-1",
    text: "지난 3번의 회의에서 5분 이상 늦었다",
    type: "fact",
    authorType: "user",
    userConfirmed: true,
    order: 0,
    ...overrides,
  };
}

export function makeStageResponse(overrides: Partial<StageResponse> = {}): StageResponse {
  const now = new Date().toISOString();
  return {
    id: id("resp"),
    sessionId: "session-1",
    stage: "exploration",
    promptKey: "context",
    content: "이 문제는 팀 전체 회의에서 반복된다",
    authorType: "user",
    hintLevelUsed: 0,
    isDraft: false,
    isStale: false,
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: id("q"),
    sessionId: "session-1",
    text: "왜 이 사람만 늦을까?",
    authorType: "user",
    order: 0,
    isPriority: false,
    hintLevelUsed: 0,
    ...overrides,
  };
}

export function makePerspective(overrides: Partial<Perspective> = {}): Perspective {
  const now = new Date().toISOString();
  return {
    id: id("persp"),
    sessionId: "session-1",
    lensType: "stakeholder",
    content: "지각하는 사람 입장에서는 이전 일정이 겹칠 수 있다",
    authorType: "user",
    order: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeReframe(overrides: Partial<Reframe> = {}): Reframe {
  return {
    id: id("reframe"),
    sessionId: "session-1",
    text: "회의 시작 시각이 참석자 이동 시간과 맞지 않는 것이 문제일 수 있다",
    authorType: "user",
    order: 0,
    ...overrides,
  };
}

export function makeProblemDefinitionVersion(
  overrides: Partial<ProblemDefinitionVersion> = {},
): ProblemDefinitionVersion {
  const now = new Date().toISOString();
  return {
    id: id("pdv"),
    sessionId: "session-1",
    versionNumber: 1,
    text: "회의 시작 시각과 이동 동선이 맞지 않아 반복 지각이 발생하고 있다",
    authorType: "user",
    createdAt: now,
    ...overrides,
  };
}

export function makeAIFeedback(overrides: Partial<AIFeedback> = {}): AIFeedback {
  const now = new Date().toISOString();
  return {
    id: id("feedback"),
    sessionId: "session-1",
    problemDefinitionVersionId: "pdv-1",
    dimensions: {},
    strength: "구체적인 시간 근거가 있다",
    improvementFocus: "다른 참석자의 경험도 확인해보면 좋겠다",
    unverifiedAssumption: "모든 참석자가 같은 동선을 갖는다고 가정했다",
    nextQuestion: "다른 사람도 같은 이유로 늦을까?",
    provider: "mock",
    model: "mock-coach-v1",
    promptVersion: "v1",
    schemaVersion: "v1",
    isStale: false,
    createdAt: now,
    ...overrides,
  };
}

export function makeCoachInteraction(
  overrides: Partial<CoachInteraction> = {},
): CoachInteraction {
  const now = new Date().toISOString();
  return {
    id: id("coach"),
    sessionId: "session-1",
    stage: "exploration",
    validatedOutput: { question: "그 사람의 상황을 알고 있나요?" },
    action: "ask_question",
    hintLevel: 0,
    provider: "mock",
    model: "mock-coach-v1",
    promptVersion: "v1",
    schemaVersion: "v1",
    latencyMs: 10,
    status: "ok",
    isStale: false,
    createdAt: now,
    ...overrides,
  };
}

/** questioning 요건(사용자 질문 3개 + 우선순위 1개+사유)을 만족하는 질문 배열. */
export function passingQuestions(): Question[] {
  return [
    makeQuestion({
      id: "q-1",
      text: "왜 이 사람만 늦을까?",
      isPriority: true,
      priorityReason: "가장 반복적임",
    }),
    makeQuestion({ id: "q-2", text: "다른 사람도 같은 경험을 했을까?" }),
    makeQuestion({ id: "q-3", text: "회의 시간을 바꾸면 나아질까?" }),
  ];
}

/** exploration 요건(4개 필수 promptKey)을 만족하는 응답 배열. */
export function passingExplorationResponses(
  stage: Stage = "exploration",
): StageResponse[] {
  return ["affected_user", "context", "impact", "unknown"].map((promptKey) =>
    makeStageResponse({ id: `resp-${promptKey}`, stage, promptKey }),
  );
}

/** reframing 요건(사용자 작성 reframe 2개)을 만족하는 배열. */
export function passingReframes(): Reframe[] {
  return [makeReframe({ id: "reframe-1" }), makeReframe({ id: "reframe-2" })];
}
