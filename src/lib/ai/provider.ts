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

export interface CoachProviderMeta {
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
}

/** Phase 4에서 실제 제공자를 이 인터페이스로 추가한다 — 호출자는 provider 구현을 모른다. */
export interface CoachProvider extends CoachProviderMeta {
  getCoachResponse(context: CoachRequestContext): Promise<CoachOutput>;
}
