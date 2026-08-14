import { z } from "zod";

/**
 * AI Coach Structured Output 계약 (PRD §7.11). `sessionId`는 서버가 이미 아는 값이라
 * 스키마에서 뺐다 — CLAUDE.md §6 "PRD 해석 판단"에 기록된 결정과 동일하다.
 */
export const coachActionSchema = z.enum([
  "ask",
  "suggest_advance",
  "feedback",
  "fallback",
  "safety",
]);

export const detectedGapSchema = z.enum([
  "observable_fact",
  "stakeholder",
  "context",
  "goal",
  "barrier",
  "impact",
  "alternative_view",
  "uncertainty",
  "scope",
]);

export const stageEnumSchema = z.enum([
  "observation",
  "separation",
  "questioning",
  "exploration",
  "reframing",
  "definition",
  "feedback",
]);

export const coachOutputSchema = z.object({
  currentStage: stageEnumSchema,
  action: coachActionSchema,
  coachMessage: z.string(),
  // PRD §7.11 규칙: 코칭 응답에서 질문은 최대 하나 — 배열이 아니라 단일 필드로 강제한다.
  question: z.string().nullable(),
  detectedGaps: z.array(detectedGapSchema),
  evidenceReferences: z.array(z.string()),
  hintLevel: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  suggestedNextStage: stageEnumSchema.nullable(),
  safetyFlags: z.array(z.string()),
});

export type CoachOutputSchema = z.infer<typeof coachOutputSchema>;
