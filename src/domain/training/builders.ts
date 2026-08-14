import type {
  AuthorType,
  Observation,
  ObservationItem,
  Perspective,
  ProblemDefinitionVersion,
  Question,
  Reframe,
  Stage,
  StageResponse,
} from "@/domain/types";

/**
 * Entity를 새로 만드는 순수 팩토리 함수. id/시각은 여기서만 부여한다.
 *
 * 파라미터 타입은 각 함수마다 필요한 최소 필드만 domain 자체 Pick으로 선언한다 —
 * `lib/schemas/stage-input.ts`의 Zod 추론 타입을 여기서 import하지 않는다. domain/은
 * 다른 레이어에 의존하지 않는 게 원칙이다(DEVELOPMENT_PLAN.md §4.1: domain의 의존 가능
 * 목록은 "아무것도"). 호출자가 Zod로 검증한 값을 넘겨도 구조가 같으면 그대로 들어맞는다.
 */

function nowIso(): string {
  return new Date().toISOString();
}

export type ObservationDraft = Pick<Observation, "rawText" | "contextWhen" | "contextWhere">;

export function buildObservation(
  sessionId: string,
  input: ObservationDraft,
  existing: Observation | null,
): Observation {
  const now = nowIso();
  return {
    id: existing?.id ?? crypto.randomUUID(),
    sessionId,
    rawText: input.rawText,
    contextWhen: input.contextWhen,
    contextWhere: input.contextWhere,
    version: (existing?.version ?? 0) + 1,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export type ObservationItemDraft = Pick<ObservationItem, "text" | "type">;

export function buildObservationItem(
  observationId: string,
  input: ObservationItemDraft,
  order: number,
  authorType: AuthorType = "user",
): ObservationItem {
  return {
    id: crypto.randomUUID(),
    observationId,
    text: input.text,
    type: input.type,
    authorType,
    userConfirmed: authorType === "user",
    order,
  };
}

export type QuestionDraft = Pick<Question, "text" | "lensType">;

export function buildQuestion(
  sessionId: string,
  input: QuestionDraft,
  order: number,
  authorType: AuthorType = "user",
): Question {
  return {
    id: crypto.randomUUID(),
    sessionId,
    text: input.text,
    authorType,
    lensType: input.lensType,
    order,
    isPriority: false,
    hintLevelUsed: 0,
  };
}

export type PerspectiveDraft = Pick<Perspective, "lensType" | "content">;

export function buildPerspective(
  sessionId: string,
  input: PerspectiveDraft,
  order: number,
  authorType: AuthorType = "user",
): Perspective {
  const now = nowIso();
  return {
    id: crypto.randomUUID(),
    sessionId,
    lensType: input.lensType,
    content: input.content,
    authorType,
    order,
    createdAt: now,
    updatedAt: now,
  };
}

export type ReframeDraft = Pick<Reframe, "text" | "lensType">;

export function buildReframe(
  sessionId: string,
  input: ReframeDraft,
  order: number,
  authorType: AuthorType = "user",
): Reframe {
  return {
    id: crypto.randomUUID(),
    sessionId,
    text: input.text,
    lensType: input.lensType,
    authorType,
    order,
  };
}

export type ProblemDefinitionDraft = Pick<ProblemDefinitionVersion, "text" | "changeReason">;

export function buildProblemDefinitionVersion(
  sessionId: string,
  input: ProblemDefinitionDraft,
  existingVersions: ProblemDefinitionVersion[],
  authorType: AuthorType = "user",
): ProblemDefinitionVersion {
  const nextVersionNumber =
    existingVersions.reduce((max, v) => Math.max(max, v.versionNumber), 0) + 1;
  return {
    id: crypto.randomUUID(),
    sessionId,
    versionNumber: nextVersionNumber,
    text: input.text,
    authorType,
    changeReason: input.changeReason,
    createdAt: nowIso(),
  };
}

export type StageResponseDraft = Pick<StageResponse, "promptKey" | "content">;

export function buildStageResponse(
  sessionId: string,
  stage: Stage,
  input: StageResponseDraft,
  hintLevelUsed: 0 | 1 | 2 = 0,
  authorType: AuthorType = "user",
): StageResponse {
  const now = nowIso();
  return {
    id: crypto.randomUUID(),
    sessionId,
    stage,
    promptKey: input.promptKey,
    content: input.content,
    authorType,
    hintLevelUsed,
    isDraft: false,
    isStale: false,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}
