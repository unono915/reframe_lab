import { z } from "zod";

/**
 * AI 피드백 Structured Output 계약 (PRD §7.8 6개 평가 차원, DEVELOPMENT_PLAN.md
 * §8.3). 필드명·status 값은 `domain/types.ts`의 `AIFeedback`/`AIFeedbackDimension`과
 * 반드시 일치해야 한다 — 그 타입이 이미 Phase 2~3에서 DB·mutate-actions.ts 전체에
 * 걸쳐 확정됐다(§8.3 초안의 `needs_work|developing|clear`/`basis`/`current`가 아니라
 * 실제로 구현된 `shown|explore_further|unverified`/`evidence`를 단일 소스로 삼는다).
 */
export const feedbackDimensionKeySchema = z.enum([
  "evidence",
  "userAndContext",
  "goalBarrierImpact",
  "factVsHypothesis",
  "perspectiveAndScope",
  "furtherInquiry",
]);

export const feedbackDimensionSchema = z.object({
  status: z.enum(["shown", "explore_further", "unverified"]),
  evidence: z.string(),
});

export const feedbackOutputSchema = z.object({
  // 전체 6개 차원을 매번 다 채워야 하는 것은 아니다(z.record(enum, ...)은 Zod에서
  // 모든 키를 필수로 만든다 — 우리가 원하는 건 부분 Map이라 키를 string으로 느슨하게
  // 받고 값만 엄격히 검증한다). 실제 6개 키 집합은 `feedbackDimensionKeySchema`가
  // 단일 소스로 남아있고, provider 쪽에서 그 값만 채우도록 관례로 강제한다.
  dimensions: z.record(z.string(), feedbackDimensionSchema),
  strength: z.string(),
  improvementFocus: z.string(),
  unverifiedAssumption: z.string(),
  nextQuestion: z.string(),
});

export type FeedbackOutputSchema = z.infer<typeof feedbackOutputSchema>;
export type FeedbackDimensionKey = z.infer<typeof feedbackDimensionKeySchema>;
