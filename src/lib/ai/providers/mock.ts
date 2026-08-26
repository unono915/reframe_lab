import { getFallbackQuestion } from "../fallback";
import type {
  CoachOutput,
  CoachProvider,
  CoachRequestContext,
  FeedbackOutput,
  FeedbackRequestContext,
} from "../provider";

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

  /**
   * 결정론적 Mock 피드백. 사용자가 실제로 쓴 문장을 그대로 인용해 근거를 만든다
   * (PRD §7.7 "사용자 문장에서 인용하거나 정확히 지칭할 수 있는 근거").
   */
  async getFeedback(context: FeedbackRequestContext): Promise<FeedbackOutput> {
    const quote =
      context.definitionText.length > 60
        ? `${context.definitionText.slice(0, 60)}…`
        : context.definitionText;
    return {
      dimensions: {},
      strength: `"${quote}"처럼 실제 문장에서 출발한 점이 좋아요.`,
      improvementFocus: "아직 확인하지 못한 사람들의 입장도 있는지 살펴보면 더 좋아요.",
      unverifiedAssumption:
        "지금 든 원인이 유일한 원인이라고 단정하지 않았는지 확인해보세요.",
      nextQuestion: "이 정의만 보고 다른 사람도 상황을 이해할 수 있을까요?",
    };
  },
};
