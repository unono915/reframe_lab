import type { HintLevel, Stage } from "@/domain/types";

export type CoachAction = "ask" | "suggest_advance" | "feedback" | "fallback" | "safety";

/** PRD §7.11 Structured Output. sessionId는 서버가 이미 알므로 뺐다(CLAUDE.md §6). */
export interface CoachOutput {
  currentStage: Stage;
  action: CoachAction;
  coachMessage: string;
  question: string | null;
  detectedGaps: string[];
  evidenceReferences: string[];
  hintLevel: HintLevel;
  suggestedNextStage: Stage | null;
  safetyFlags: string[];
}

export interface CoachRequestContext {
  stage: Stage;
  hintLevel: HintLevel;
  userText: string;
  recentQuestions?: string[];
}

export type FeedbackDimensionStatus = "shown" | "explore_further" | "unverified";

export interface FeedbackDimension {
  status: FeedbackDimensionStatus;
  evidence: string;
}

/** PRD §7.8의 6개 평가 차원. `lib/schemas/feedback-output.ts`가 Zod로 이 형태를 강제한다. */
export interface FeedbackOutput {
  dimensions: Record<string, FeedbackDimension>;
  strength: string;
  improvementFocus: string;
  unverifiedAssumption: string;
  nextQuestion: string;
}

export interface FeedbackRequestContext {
  /** 사용자가 쓴 최신 문제 정의 문장(v1 또는 그 이후). */
  definitionText: string;
  /** 근거로 인용할 수 있는, 앞선 단계의 사용자 원문(관찰·구분·질문·탐색·재정의). */
  supportingText: string;
}

export interface CoachProviderMeta {
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
}

/** Phase 4에서 실제 제공자를 이 인터페이스로 추가한다 — 호출자는 provider 구현을 모른다. */
export interface CoachProvider extends CoachProviderMeta {
  getCoachResponse(context: CoachRequestContext): Promise<CoachOutput>;
  getFeedback(context: FeedbackRequestContext): Promise<FeedbackOutput>;
}
