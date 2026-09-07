import { z } from "zod";
import { SELF_CHECK_ITEMS, type SelfCheckKey } from "@/domain/training/requirements";

/**
 * 단계별 사용자 입력 Zod 스키마. Client(react-hook-form)·Server(Route Handler, Phase 3)가
 * 같은 스키마를 공유한다(PRD §15.1). 여기서 검증하는 것은 "payload 모양이 맞는가"뿐이다 —
 * "이 정도면 다음 단계로 갈 수 있는가"는 `domain/training/requirements.ts`의 책임이고
 * 그 둘은 절대 합치지 않는다(DEVELOPMENT_PLAN.md §7.3 5번↔6번 단계가 분리된 이유와 같다).
 */

/**
 * 입력 길이 상한. 화면과 검증이 같은 값을 보게 하려고 상수로 뺀다 — 화면에 숫자를
 * 다시 적으면 스키마를 고칠 때 조용히 어긋나고, 그러면 "쓸 수 있다고 해놓고 저장할 때
 * 거부하는" 상태가 된다.
 *
 * DESIGN.md §579: Character Counter는 **제한에 가까워질 때만** 노출한다.
 */
export const INPUT_LIMITS = {
  observationRawText: 2000,
  observationContext: 200,
  observationItemText: 500,
  questionText: 300,
  priorityReason: 300,
  perspectiveContent: 500,
  reframeText: 500,
  definitionText: 1000,
  changeReason: 500,
  stageResponseContent: 2000,
} as const;

/**
 * 상한을 넘겼을 때의 문구. Zod 기본 메시지는 영어라("Too big: expected string...")
 * 한국어 전용 화면에 그대로 나갔다 — 사용자는 무엇이 문제인지도, 얼마나 줄여야
 * 하는지도 알 수 없다.
 */
function tooLong(max: number): string {
  return `${max}자 이내로 줄여주세요.`;
}

// ---- observation ----

export const observationInputSchema = z.object({
  rawText: z
    .string()
    .trim()
    .min(1, "관찰한 장면을 한 문장 이상 남겨주세요.")
    .max(INPUT_LIMITS.observationRawText, tooLong(INPUT_LIMITS.observationRawText)),
  contextWhen: z
    .string()
    .trim()
    .max(INPUT_LIMITS.observationContext, tooLong(INPUT_LIMITS.observationContext))
    .optional(),
  contextWhere: z
    .string()
    .trim()
    .max(INPUT_LIMITS.observationContext, tooLong(INPUT_LIMITS.observationContext))
    .optional(),
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
  text: z
    .string()
    .trim()
    .min(1, "내용을 입력해주세요.")
    .max(INPUT_LIMITS.observationItemText, tooLong(INPUT_LIMITS.observationItemText)),
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
  text: z
    .string()
    .trim()
    .min(1, "질문을 입력해주세요.")
    .max(INPUT_LIMITS.questionText, tooLong(INPUT_LIMITS.questionText)),
  lensType: questionLensSchema.optional(),
});
export type QuestionInput = z.infer<typeof questionInputSchema>;

export const priorityQuestionInputSchema = z.object({
  questionId: z.string().min(1),
  priorityReason: z
    .string()
    .trim()
    .min(1, "선택한 이유를 남겨주세요.")
    .max(INPUT_LIMITS.priorityReason, tooLong(INPUT_LIMITS.priorityReason)),
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
  content: z
    .string()
    .trim()
    .min(1, "발견한 내용을 적어주세요.")
    .max(INPUT_LIMITS.perspectiveContent, tooLong(INPUT_LIMITS.perspectiveContent)),
});
export type PerspectiveInput = z.infer<typeof perspectiveInputSchema>;

export const reframeInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "대안 프레임을 적어주세요.")
    .max(INPUT_LIMITS.reframeText, tooLong(INPUT_LIMITS.reframeText)),
  lensType: perspectiveLensSchema.optional(),
});
export type ReframeInput = z.infer<typeof reframeInputSchema>;

// ---- definition ----

export const problemDefinitionInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "현재의 문제 정의를 적어주세요.")
    .max(INPUT_LIMITS.definitionText, tooLong(INPUT_LIMITS.definitionText)),
  changeReason: z
    .string()
    .trim()
    .max(INPUT_LIMITS.changeReason, tooLong(INPUT_LIMITS.changeReason))
    .optional(),
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
  content: z
    .string()
    .trim()
    .min(1, "내용을 입력해주세요.")
    .max(INPUT_LIMITS.stageResponseContent, tooLong(INPUT_LIMITS.stageResponseContent)),
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
