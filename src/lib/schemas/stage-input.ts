import { z } from "zod";
import { SELF_CHECK_ITEMS, type SelfCheckKey } from "@/domain/training/requirements";

/**
 * 단계별 사용자 입력 Zod 스키마. Client(react-hook-form)·Server(Route Handler, Phase 3)가
 * 같은 스키마를 공유한다(PRD §15.1). 여기서 검증하는 것은 "payload 모양이 맞는가"뿐이다 —
 * "이 정도면 다음 단계로 갈 수 있는가"는 `domain/training/requirements.ts`의 책임이고
 * 그 둘은 절대 합치지 않는다(DEVELOPMENT_PLAN.md §7.3 5번↔6번 단계가 분리된 이유와 같다).
 */

// ---- observation ----

export const observationInputSchema = z.object({
  rawText: z.string().trim().min(1, "관찰한 장면을 한 문장 이상 남겨주세요.").max(2000),
  contextWhen: z.string().trim().max(200).optional(),
  contextWhere: z.string().trim().max(200).optional(),
});
export type ObservationInput = z.infer<typeof observationInputSchema>;

// ---- separation ----

export const observationItemTypeSchema = z.enum([
  "fact",
  "interpretation",
  "assumption",
  "emotion",
  "solution",
]);

export const observationItemInputSchema = z.object({
  text: z.string().trim().min(1, "내용을 입력해주세요.").max(500),
  type: observationItemTypeSchema,
});
export type ObservationItemInput = z.infer<typeof observationItemInputSchema>;

// ---- questioning ----

export const questionLensSchema = z.enum([
  "person",
  "situation",
  "time",
  "impact",
  "counter_example",
  "cause_hypothesis",
  "evidence",
  "boundary",
]);

export const questionInputSchema = z.object({
  text: z.string().trim().min(1, "질문을 입력해주세요.").max(300),
  lensType: questionLensSchema.optional(),
});
export type QuestionInput = z.infer<typeof questionInputSchema>;

export const priorityQuestionInputSchema = z.object({
  questionId: z.string().min(1),
  priorityReason: z.string().trim().min(1, "선택한 이유를 남겨주세요.").max(300),
});
export type PriorityQuestionInput = z.infer<typeof priorityQuestionInputSchema>;

// ---- reframing ----

export const perspectiveLensSchema = z.enum([
  "stakeholder",
  "timeframe",
  "scope",
  "structure",
  "counter_example",
  "causality",
  "most_disadvantaged",
]);

export const perspectiveInputSchema = z.object({
  lensType: perspectiveLensSchema,
  content: z.string().trim().min(1, "발견한 내용을 적어주세요.").max(500),
});
export type PerspectiveInput = z.infer<typeof perspectiveInputSchema>;

export const reframeInputSchema = z.object({
  text: z.string().trim().min(1, "대안 프레임을 적어주세요.").max(500),
  lensType: perspectiveLensSchema.optional(),
});
export type ReframeInput = z.infer<typeof reframeInputSchema>;

// ---- definition ----

export const problemDefinitionInputSchema = z.object({
  text: z.string().trim().min(1, "현재의 문제 정의를 적어주세요.").max(1000),
  changeReason: z.string().trim().max(500).optional(),
});
export type ProblemDefinitionInput = z.infer<typeof problemDefinitionInputSchema>;

// ---- 자유 응답형 StageResponse 공용 스키마 ----
// exploration의 4개 필수 프롬프트, 그리고 observation/separation/questioning/reframing의
// 예외 사유, feedback의 자기 점검 체크리스트는 전부 { stage, promptKey, content } 한 형태로
// 저장된다(requirements.ts EXCEPTION_PROMPT_KEYS 참고) — 스키마도 하나로 공유한다.

export const explorationPromptKeySchema = z.enum([
  "affected_user",
  "context",
  "impact",
  "unknown",
]);

export const stageResponseInputSchema = z.object({
  promptKey: z.string().min(1),
  content: z.string().trim().min(1, "내용을 입력해주세요.").max(2000),
});
export type StageResponseInput = z.infer<typeof stageResponseInputSchema>;

// ---- feedback 단계 자기 점검 (RESEARCH_VALIDATION.md §5 P0-2) ----
// 키 목록은 `domain/training/requirements.ts`의 SELF_CHECK_ITEMS가 정본이다.
// 여기서 enum을 새로 쓰지 않고 그 배열에서 파생시켜 드리프트를 막는다.

const selfCheckKeys = SELF_CHECK_ITEMS.map((item) => item.key);

export const selfCheckKeySchema = z.enum(
  selfCheckKeys as [SelfCheckKey, ...SelfCheckKey[]],
);

export const selfAssessmentInputSchema = z.object({
  assessments: z
    .array(
      z.object({
        key: selfCheckKeySchema,
        status: z.enum(["shown", "not_yet"]),
      }),
    )
    // 6개를 모두 받는다 — 일부만 답한 상태로 AI 판정과 대조하면 의미가 없다.
    .length(selfCheckKeys.length),
});
export type SelfAssessmentInput = z.infer<typeof selfAssessmentInputSchema>;

export const explorationResponseInputSchema = stageResponseInputSchema.extend({
  promptKey: explorationPromptKeySchema,
});
export type ExplorationResponseInput = z.infer<typeof explorationResponseInputSchema>;
