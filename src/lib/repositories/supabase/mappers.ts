import type {
  AIFeedback,
  AuthorType,
  CoachInteraction,
  HintLevel,
  ItemType,
  Observation,
  ObservationItem,
  PerspectiveLens,
  Perspective,
  ProblemDefinitionVersion,
  Question,
  QuestionLens,
  Reframe,
  Stage,
  StageResponse,
  TrainingSession,
  TrainingTemplate,
} from "@/domain/types";
import type { Database } from "@/lib/supabase/database.types";

/**
 * DB(snake_case) ↔ domain(camelCase) 양방향 변환. `domain/types.ts`가 필드의 단일
 * 소스이므로, 여기서 필드를 추가·변경할 일이 생기면 그 파일부터 고치고 이 파일을
 * 따라오게 한다 (레이어 규칙상 반대 방향은 금지 — DEVELOPMENT_PLAN.md §4.1).
 */

type TemplateRow = Database["public"]["Tables"]["training_templates"]["Row"];
type SessionRow = Database["public"]["Tables"]["training_sessions"]["Row"];
type ObservationRow = Database["public"]["Tables"]["observations"]["Row"];
type ObservationItemRow = Database["public"]["Tables"]["observation_items"]["Row"];
type StageResponseRow = Database["public"]["Tables"]["stage_responses"]["Row"];
type QuestionRow = Database["public"]["Tables"]["questions"]["Row"];
type PerspectiveRow = Database["public"]["Tables"]["perspectives"]["Row"];
type ReframeRow = Database["public"]["Tables"]["reframes"]["Row"];
type ProblemDefinitionVersionRow =
  Database["public"]["Tables"]["problem_definition_versions"]["Row"];
type AIFeedbackRow = Database["public"]["Tables"]["ai_feedbacks"]["Row"];
type CoachInteractionRow = Database["public"]["Tables"]["coach_interactions"]["Row"];

export function templateRowToDomain(row: TemplateRow): TrainingTemplate {
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    lensType: row.lens_type as TrainingTemplate["lensType"],
    difficulty: row.difficulty as 1 | 2 | 3,
    version: row.version,
    active: row.active,
  };
}

export function sessionRowToDomain(row: SessionRow): TrainingSession {
  return {
    id: row.id,
    clientGeneratedId: row.client_generated_id,
    userId: row.user_id,
    templateId: row.template_id,
    trainingDate: row.training_date,
    timezone: row.timezone,
    status: row.status as TrainingSession["status"],
    currentStage: row.current_stage as Stage,
    lastActiveStage: (row.last_active_stage as Stage | null) ?? null,
    stateVersion: row.state_version,
    aiCallCount: row.ai_call_count,
    originSessionId: row.origin_session_id ?? undefined,
    startedAt: row.started_at,
    lastActiveAt: row.last_active_at,
    completedAt: row.completed_at ?? undefined,
    abandonedAt: row.abandoned_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function sessionDomainToRow(
  session: TrainingSession,
): Database["public"]["Tables"]["training_sessions"]["Insert"] {
  return {
    id: session.id,
    client_generated_id: session.clientGeneratedId,
    user_id: session.userId,
    template_id: session.templateId,
    training_date: session.trainingDate,
    timezone: session.timezone,
    status: session.status,
    current_stage: session.currentStage,
    last_active_stage: session.lastActiveStage,
    state_version: session.stateVersion,
    ai_call_count: session.aiCallCount,
    origin_session_id: session.originSessionId ?? null,
    started_at: session.startedAt,
    last_active_at: session.lastActiveAt,
    completed_at: session.completedAt ?? null,
    abandoned_at: session.abandonedAt ?? null,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  };
}

export function observationRowToDomain(row: ObservationRow): Observation {
  return {
    id: row.id,
    sessionId: row.session_id,
    rawText: row.raw_text,
    contextWhen: row.context_when ?? undefined,
    contextWhere: row.context_where ?? undefined,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function observationDomainToRow(
  observation: Observation,
): Database["public"]["Tables"]["observations"]["Insert"] {
  return {
    id: observation.id,
    session_id: observation.sessionId,
    raw_text: observation.rawText,
    context_when: observation.contextWhen ?? null,
    context_where: observation.contextWhere ?? null,
    version: observation.version,
    created_at: observation.createdAt,
    updated_at: observation.updatedAt,
  };
}

export function observationItemRowToDomain(row: ObservationItemRow): ObservationItem {
  return {
    id: row.id,
    observationId: row.observation_id,
    text: row.text,
    type: row.type as ItemType,
    authorType: row.author_type as AuthorType,
    userConfirmed: row.user_confirmed,
    order: row.item_order,
  };
}

export function observationItemDomainToRow(
  item: ObservationItem,
): Database["public"]["Tables"]["observation_items"]["Insert"] {
  return {
    id: item.id,
    observation_id: item.observationId,
    text: item.text,
    type: item.type,
    author_type: item.authorType,
    user_confirmed: item.userConfirmed,
    item_order: item.order,
  };
}

export function stageResponseRowToDomain(row: StageResponseRow): StageResponse {
  return {
    id: row.id,
    sessionId: row.session_id,
    stage: row.stage as Stage,
    promptKey: row.prompt_key,
    content: row.content,
    authorType: row.author_type as AuthorType,
    hintLevelUsed: row.hint_level_used as HintLevel,
    isDraft: row.is_draft,
    isStale: row.is_stale,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function stageResponseDomainToRow(
  response: StageResponse,
): Database["public"]["Tables"]["stage_responses"]["Insert"] {
  return {
    id: response.id,
    session_id: response.sessionId,
    stage: response.stage,
    prompt_key: response.promptKey,
    content: response.content,
    author_type: response.authorType,
    hint_level_used: response.hintLevelUsed,
    is_draft: response.isDraft,
    is_stale: response.isStale,
    version: response.version,
    created_at: response.createdAt,
    updated_at: response.updatedAt,
  };
}

export function questionRowToDomain(row: QuestionRow): Question {
  return {
    id: row.id,
    sessionId: row.session_id,
    text: row.text,
    authorType: row.author_type as AuthorType,
    lensType: (row.lens_type as QuestionLens | null) ?? undefined,
    order: row.question_order,
    isPriority: row.is_priority,
    priorityReason: row.priority_reason ?? undefined,
    hintLevelUsed: row.hint_level_used as HintLevel,
  };
}

export function questionDomainToRow(
  question: Question,
): Database["public"]["Tables"]["questions"]["Insert"] {
  return {
    id: question.id,
    session_id: question.sessionId,
    text: question.text,
    author_type: question.authorType,
    lens_type: question.lensType ?? null,
    question_order: question.order,
    is_priority: question.isPriority,
    priority_reason: question.priorityReason ?? null,
    hint_level_used: question.hintLevelUsed,
  };
}

export function perspectiveRowToDomain(row: PerspectiveRow): Perspective {
  return {
    id: row.id,
    sessionId: row.session_id,
    lensType: row.lens_type as PerspectiveLens,
    content: row.content,
    authorType: row.author_type as AuthorType,
    order: row.perspective_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function perspectiveDomainToRow(
  perspective: Perspective,
): Database["public"]["Tables"]["perspectives"]["Insert"] {
  return {
    id: perspective.id,
    session_id: perspective.sessionId,
    lens_type: perspective.lensType,
    content: perspective.content,
    author_type: perspective.authorType,
    perspective_order: perspective.order,
    created_at: perspective.createdAt,
    updated_at: perspective.updatedAt,
  };
}

export function reframeRowToDomain(row: ReframeRow): Reframe {
  return {
    id: row.id,
    sessionId: row.session_id,
    text: row.text,
    lensType: (row.lens_type as PerspectiveLens | null) ?? undefined,
    authorType: row.author_type as AuthorType,
    order: row.reframe_order,
    selectedElements: row.selected_elements ?? undefined,
  };
}

export function reframeDomainToRow(
  reframe: Reframe,
): Database["public"]["Tables"]["reframes"]["Insert"] {
  return {
    id: reframe.id,
    session_id: reframe.sessionId,
    text: reframe.text,
    lens_type: reframe.lensType ?? null,
    author_type: reframe.authorType,
    reframe_order: reframe.order,
    selected_elements: reframe.selectedElements ?? null,
  };
}

export function problemDefinitionVersionRowToDomain(
  row: ProblemDefinitionVersionRow,
): ProblemDefinitionVersion {
  return {
    id: row.id,
    sessionId: row.session_id,
    versionNumber: row.version_number,
    text: row.text,
    authorType: row.author_type as AuthorType,
    changeReason: row.change_reason ?? undefined,
    basedOnFeedbackId: row.based_on_feedback_id ?? undefined,
    createdAt: row.created_at,
  };
}

export function problemDefinitionVersionDomainToRow(
  pdv: ProblemDefinitionVersion,
): Database["public"]["Tables"]["problem_definition_versions"]["Insert"] {
  return {
    id: pdv.id,
    session_id: pdv.sessionId,
    version_number: pdv.versionNumber,
    text: pdv.text,
    author_type: pdv.authorType,
    change_reason: pdv.changeReason ?? null,
    based_on_feedback_id: null, // 순환 참조 — Repository가 ai_feedbacks 삽입 후 별도로 채운다.
    created_at: pdv.createdAt,
  };
}

export function aiFeedbackRowToDomain(row: AIFeedbackRow): AIFeedback {
  return {
    id: row.id,
    sessionId: row.session_id,
    problemDefinitionVersionId: row.problem_definition_version_id,
    dimensions: row.dimensions as unknown as AIFeedback["dimensions"],
    strength: row.strength,
    improvementFocus: row.improvement_focus,
    unverifiedAssumption: row.unverified_assumption,
    nextQuestion: row.next_question,
    provider: row.provider,
    model: row.model,
    promptVersion: row.prompt_version,
    schemaVersion: row.schema_version,
    isStale: row.is_stale,
    createdAt: row.created_at,
  };
}

export function aiFeedbackDomainToRow(
  feedback: AIFeedback,
): Database["public"]["Tables"]["ai_feedbacks"]["Insert"] {
  return {
    id: feedback.id,
    session_id: feedback.sessionId,
    problem_definition_version_id: feedback.problemDefinitionVersionId,
    dimensions: feedback.dimensions as unknown as Database["public"]["Tables"]["ai_feedbacks"]["Insert"]["dimensions"],
    strength: feedback.strength,
    improvement_focus: feedback.improvementFocus,
    unverified_assumption: feedback.unverifiedAssumption,
    next_question: feedback.nextQuestion,
    provider: feedback.provider,
    model: feedback.model,
    prompt_version: feedback.promptVersion,
    schema_version: feedback.schemaVersion,
    is_stale: feedback.isStale,
    created_at: feedback.createdAt,
  };
}

export function coachInteractionRowToDomain(row: CoachInteractionRow): CoachInteraction {
  return {
    id: row.id,
    sessionId: row.session_id,
    stage: row.stage as Stage,
    validatedOutput: row.validated_output,
    action: row.action,
    hintLevel: row.hint_level as HintLevel,
    provider: row.provider,
    model: row.model,
    promptVersion: row.prompt_version,
    schemaVersion: row.schema_version,
    latencyMs: row.latency_ms,
    status: row.status as CoachInteraction["status"],
    errorCode: row.error_code ?? undefined,
    isStale: row.is_stale,
    createdAt: row.created_at,
  };
}

export function coachInteractionDomainToRow(
  interaction: CoachInteraction,
): Database["public"]["Tables"]["coach_interactions"]["Insert"] {
  return {
    id: interaction.id,
    session_id: interaction.sessionId,
    stage: interaction.stage,
    validated_output: interaction.validatedOutput as Database["public"]["Tables"]["coach_interactions"]["Insert"]["validated_output"],
    action: interaction.action,
    hint_level: interaction.hintLevel,
    provider: interaction.provider,
    model: interaction.model,
    prompt_version: interaction.promptVersion,
    schema_version: interaction.schemaVersion,
    latency_ms: interaction.latencyMs,
    status: interaction.status,
    error_code: interaction.errorCode ?? null,
    is_stale: interaction.isStale,
    created_at: interaction.createdAt,
  };
}
