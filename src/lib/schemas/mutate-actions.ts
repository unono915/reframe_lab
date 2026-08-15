import { z } from "zod";
import {
  explorationResponseInputSchema,
  observationInputSchema,
  observationItemInputSchema,
  perspectiveInputSchema,
  priorityQuestionInputSchema,
  problemDefinitionInputSchema,
  questionInputSchema,
  reframeInputSchema,
  stageResponseInputSchema,
} from "./stage-input";

/**
 * `POST /api/sessions/:id/mutate`의 요청 계약. `TrainingSessionProvider`의 11개
 * 세분화된 액션과 1:1 대응한다 — 클라이언트는 여전히 "무엇을 하고 싶은지"만 보내고,
 * 실제 domain builder 호출(id·시각 부여)은 서버가 한다. 클라이언트 코드를 신뢰해
 * 임의 함수를 실행하는 것이 아니라, 이 화이트리스트에 있는 액션만 실행된다.
 */

const hintLevelSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);

export const mutateActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submitObservation"), args: observationInputSchema }),
  z.object({ action: z.literal("addObservationItem"), args: observationItemInputSchema }),
  z.object({
    action: z.literal("confirmObservationItem"),
    args: z.object({ itemId: z.string().min(1), confirmed: z.boolean() }),
  }),
  z.object({
    action: z.literal("addQuestion"),
    args: z.object({ input: questionInputSchema, hintLevelUsed: hintLevelSchema }),
  }),
  z.object({ action: z.literal("markPriorityQuestion"), args: priorityQuestionInputSchema }),
  z.object({
    action: z.literal("addExplorationResponse"),
    args: explorationResponseInputSchema,
  }),
  z.object({ action: z.literal("addPerspective"), args: perspectiveInputSchema }),
  z.object({
    action: z.literal("addReframe"),
    args: z.object({ input: reframeInputSchema, hintLevelUsed: hintLevelSchema }),
  }),
  z.object({ action: z.literal("submitDefinition"), args: problemDefinitionInputSchema }),
  z.object({ action: z.literal("submitExceptionReason"), args: stageResponseInputSchema }),
  z.object({ action: z.literal("completeSelfCheck"), args: z.object({}) }),
]);

/**
 * `expectedStateVersion`을 여기 넣지 않는다 — Phase 2에서 이미 검증된 계약대로
 * `state_version`은 단계 전환(advance/pause/resume/abandon)에서만 증가한다
 * (state-machine.test.ts). 데이터 추가·수정(질문 하나 더 쓰기 등)은 그 자체로는
 * 전환이 아니므로 낙관적 동시성 검사 대상이 아니다 — 전환 시점의 `advance` 호출이
 * 최종 방어선이다.
 */
export const mutateRequestSchema = z.object({
  clientRequestId: z.string().min(1),
  mutation: mutateActionSchema,
});
export type MutateRequest = z.infer<typeof mutateRequestSchema>;
export type MutateAction = z.infer<typeof mutateActionSchema>;
