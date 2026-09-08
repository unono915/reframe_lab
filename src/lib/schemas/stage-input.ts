import { z } from "zod";
import {
  EXCEPTION_PROMPT_KEYS,
  SELF_CHECK_ITEMS,
  type SelfCheckKey,
} from "@/domain/training/requirements";

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

/**
 * 예외 사유 전용 스키마.
 *
 * `stageResponseInputSchema`는 `promptKey`를 아무 문자열이나 받는다. 그런데 이 앱은
 * `stage_responses`의 promptKey를 **예약 표식**으로도 쓴다 — "오늘은 혼자 해보기"
 * (`solo_mode`), 자기 점검 답변(`self_check_*`), 자기 점검 완료
 * (`self_checklist_completed`). 예외 사유 저장 경로가 그 이름들을 그대로 받아주면,
 * 잘못 만든 요청 하나로 세션에 없던 표식이 생긴다.
 *
 * 실제 피해는 남의 데이터가 아니라 **지표의 진실성**이다. 전이 프로브는 "사용자의
 * 명시적 선택이 있어야만 센다"는 전제 위에 서 있고(P1-6), 그 전제가 깨지면 Growth의
 * "혼자 해낸 기록"은 예전에 한 번 그랬던 것처럼 다시 허위 신호가 된다.
 *
 * 클라이언트 타입은 이미 이 네 개로 좁혀져 있지만, 그건 클라이언트의 약속일 뿐이다 —
 * 서버는 클라이언트가 보낸 값을 신뢰하지 않는다(원칙 6). 목록은 `EXCEPTION_PROMPT_KEYS`
 * 에서 파생시켜 드리프트를 막는다(`explorationResponseInputSchema`와 같은 방식).
 */
const exceptionPromptKeys = Object.values(EXCEPTION_PROMPT_KEYS);

export const exceptionReasonInputSchema = stageResponseInputSchema.extend({
  promptKey: z.enum(exceptionPromptKeys as [string, ...string[]]),
});
export type ExceptionReasonInput = z.infer<typeof exceptionReasonInputSchema>;
