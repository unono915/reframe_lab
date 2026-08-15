/**
 * 다시봄 도메인 공용 타입. 순수 TypeScript — React·Next·Supabase·AI SDK를 import하지 않는다
 * (DEVELOPMENT_PLAN.md §4.1 레이어 규칙, eslint.config.mjs가 강제한다).
 *
 * Enum은 PRD §12.1과 DEVELOPMENT_PLAN.md §6.4를 그대로 옮긴 것이 단일 소스다.
 * DB는 Postgres `text` + `CHECK` 제약으로 구현하므로(§6.4), 이 파일의 문자열 리터럴이
 * 최종적으로 DB 값과도 1:1로 맞아야 한다 — 이름을 바꾸려면 이 파일부터 바꾼다.
 */

// ---- Stage / Status ----

export const STAGES = [
  "not_started",
  "observation",
  "separation",
  "questioning",
  "exploration",
  "reframing",
  "definition",
  "feedback",
] as const;

export type Stage = (typeof STAGES)[number];

export const TERMINAL_STATUSES = ["completed", "paused", "abandoned"] as const;

export type SessionStatus = Stage | (typeof TERMINAL_STATUSES)[number];

// ---- Authorship (원칙 6: 모든 산출물에 author_type을 저장한다) ----

export type AuthorType = "user" | "ai" | "system_template";

// ---- 분류·렌즈 Enum ----

export type ItemType = "fact" | "interpretation" | "assumption" | "emotion" | "solution";

export type QuestionLens =
  | "person"
  | "situation"
  | "time"
  | "impact"
  | "counter_example"
  | "cause_hypothesis"
  | "evidence"
  | "boundary";

export type PerspectiveLens =
  | "stakeholder"
  | "timeframe"
  | "scope"
  | "structure"
  | "counter_example"
  | "causality"
  | "most_disadvantaged";

export type TemplateLens =
  | "repetition"
  | "delay"
  | "omission"
  | "goal_mismatch"
  | "unfair_process"
  | "counter_example"
  | "unfounded_rule"
  | "info_timing";

/** 0=힌트 없음, 1=약한 힌트, 2=강한 힌트. PRD §7.6. */
export type HintLevel = 0 | 1 | 2;

// ---- Entity (PRD §11.2) ----

export interface TrainingTemplate {
  id: string;
  title: string;
  prompt: string;
  lensType: TemplateLens;
  difficulty: 1 | 2 | 3;
  version: number;
  active: boolean;
}

export interface Observation {
  id: string;
  sessionId: string;
  rawText: string;
  contextWhen?: string;
  contextWhere?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ObservationItem {
  id: string;
  observationId: string;
  text: string;
  type: ItemType;
  authorType: AuthorType;
  /** AI 제안은 이 값이 true가 되기 전까지 확정이 아니다 (PRD §11.2). */
  userConfirmed: boolean;
  order: number;
}

export interface StageResponse {
  id: string;
  sessionId: string;
  stage: Stage;
  promptKey: string;
  content: string;
  authorType: AuthorType;
  hintLevelUsed: HintLevel;
  isDraft: boolean;
  isStale: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  sessionId: string;
  text: string;
  authorType: AuthorType;
  lensType?: QuestionLens;
  order: number;
  isPriority: boolean;
  priorityReason?: string;
  hintLevelUsed: HintLevel;
}

export interface Perspective {
  id: string;
  sessionId: string;
  lensType: PerspectiveLens;
  content: string;
  authorType: AuthorType;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Reframe {
  id: string;
  sessionId: string;
  text: string;
  lensType?: PerspectiveLens;
  authorType: AuthorType;
  order: number;
  selectedElements?: string[];
}

export interface ProblemDefinitionVersion {
  id: string;
  sessionId: string;
  versionNumber: number;
  text: string;
  authorType: AuthorType;
  changeReason?: string;
  basedOnFeedbackId?: string;
  createdAt: string;
}

export interface AIFeedbackDimension {
  status: "shown" | "explore_further" | "unverified";
  evidence: string;
}

export interface AIFeedback {
  id: string;
  sessionId: string;
  problemDefinitionVersionId: string;
  dimensions: Record<string, AIFeedbackDimension>;
  strength: string;
  improvementFocus: string;
  unverifiedAssumption: string;
  nextQuestion: string;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  isStale: boolean;
  createdAt: string;
}

export interface CoachInteraction {
  id: string;
  sessionId: string;
  stage: Stage;
  validatedOutput: unknown;
  action: string;
  hintLevel: HintLevel;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  latencyMs: number;
  status: "ok" | "error" | "fallback";
  errorCode?: string;
  isStale: boolean;
  createdAt: string;
}

export type SessionEventType =
  | "started"
  | "stage_completed"
  | "resumed"
  | "paused"
  | "abandoned"
  | "completed"
  | "revisited";

export interface SessionEvent {
  id: string;
  sessionId: string;
  eventType: SessionEventType;
  stage: Stage;
  /** 민감정보(사용자 원문) 미포함. PRD §11.2. */
  metadata?: Record<string, string | number | boolean>;
  createdAt: string;
}

export interface TrainingSession {
  id: string;
  clientGeneratedId: string;
  userId: string;
  templateId: string;
  trainingDate: string;
  timezone: string;
  status: SessionStatus;
  currentStage: Stage;
  lastActiveStage: Stage | null;
  stateVersion: number;
  aiCallCount: number;
  originSessionId?: string;
  startedAt: string;
  lastActiveAt: string;
  completedAt?: string;
  abandonedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * History·Growth·Home이 쓰는 조회 전용 요약. 전체 스냅샷(`TrainingSessionSnapshot`)이
 * 아니라 이 축소 모델을 쓰는 이유는 두 가지다:
 *
 * 1. **쿼리 수** — 스냅샷 하나를 만들려면 자식 테이블까지 10개 쿼리가 필요하다.
 *    목록 화면이 세션마다 그걸 하면 N+1이 된다(36개 기록에서 360쿼리·1~3초 실측).
 * 2. **전송량** — 목록에 쓰지도 않는 coach_interactions·stage_responses까지 실어
 *    보내면 36개 기록에 143KB였다. 매일 쌓이는 앱이라 선형으로 나빠진다.
 *
 * `TrainingHistory`/`GrowthMetric`을 별도 Entity로 만들지 않는다는 설계 결정
 * (DEVELOPMENT_PLAN.md §6 "조회 모델·계산 함수")의 "조회 모델"이 바로 이것이다 —
 * 저장되는 실체가 아니라 기존 테이블에서 매번 파생시키는 읽기 전용 뷰다.
 */
export interface SessionSummary {
  id: string;
  trainingDate: string;
  status: SessionStatus;
  templateId: string;
  originSessionId?: string;
  /** History Row에 보여줄 관찰 첫 문장. 관찰 작성 전이면 null. */
  observationText: string | null;
  /** 최신 버전의 문제 정의 문장. 아직 없으면 null. */
  latestDefinitionText: string | null;
  /** Growth "직접 작성한 재정의" 집계용 — 사용자가 쓴 reframe 개수. */
  userReframeCount: number;
  /** Growth "정의를 다시 써본 기록" 집계용 — 사용자가 쓴 v2 이상이 있는지. */
  hasUserRevisedDefinition: boolean;
}

/**
 * 세션 하나의 전체 산출물 스냅샷. `domain/training/*`의 순수 함수는 전부 이 타입을
 * 입력받아 판정한다 — 서버 Route Handler와 클라이언트가 같은 함수에 같은 스냅샷을
 * 넘기는 것이 "상태 전환의 유일한 판정자"(DEVELOPMENT_PLAN.md §4.2) 원칙의 실제 구현이다.
 */
export interface TrainingSessionSnapshot {
  session: TrainingSession;
  observation: Observation | null;
  observationItems: ObservationItem[];
  stageResponses: StageResponse[];
  questions: Question[];
  perspectives: Perspective[];
  reframes: Reframe[];
  problemDefinitionVersions: ProblemDefinitionVersion[];
  aiFeedbacks: AIFeedback[];
  coachInteractions: CoachInteraction[];
}
