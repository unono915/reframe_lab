import { getFallbackQuestion } from "../fallback";
import type { CoachOutput, CoachProvider, CoachRequestContext } from "../provider";

/**
 * 결정론적 Mock Coach (Phase 2~3용). 항상 질문 정확히 1개를 포함한 유효한
 * CoachOutput을 반환한다 — `fallback.ts`의 질문 은행을 감싼 것뿐이라 실패하지 않는다.
 * 근거 없는 사실을 만들지 않도록 evidenceReferences는 항상 비워 둔다(Evidence boundary).
 */
export const mockCoachProvider: CoachProvider = {
  provider: "mock",
  model: "mock-coach-v1",
  promptVersion: "v1",
  schemaVersion: "v1",

  async getCoachResponse(context: CoachRequestContext): Promise<CoachOutput> {
    const question = getFallbackQuestion(context.stage, context.hintLevel);
    return {
      currentStage: context.stage,
      action: "ask",
      coachMessage: "",
      question,
      detectedGaps: [],
      evidenceReferences: [],
      hintLevel: context.hintLevel,
      suggestedNextStage: null,
      safetyFlags: [],
    };
  },
};
