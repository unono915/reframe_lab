import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrainingSessionSnapshot } from "@/domain/types";
import type { Database } from "@/lib/supabase/database.types";
import type { CreateSessionParams, SessionRepository } from "../types";
import {
  aiFeedbackDomainToRow,
  aiFeedbackRowToDomain,
  coachInteractionDomainToRow,
  coachInteractionRowToDomain,
  observationDomainToRow,
  observationItemDomainToRow,
  observationItemRowToDomain,
  observationRowToDomain,
  perspectiveDomainToRow,
  perspectiveRowToDomain,
  problemDefinitionVersionDomainToRow,
  problemDefinitionVersionRowToDomain,
  questionDomainToRow,
  questionRowToDomain,
  reframeDomainToRow,
  reframeRowToDomain,
  sessionDomainToRow,
  sessionRowToDomain,
  stageResponseDomainToRow,
  stageResponseRowToDomain,
} from "./mappers";

const ACTIVE_STATUS_FILTER = ["completed", "abandoned"];

/**
 * `memory/session-repository.ts`와 동일한 인터페이스의 Supabase 구현. 읽기는 일반
 * PostgREST 쿼리로, 쓰기(`saveSnapshot`)는 `save_training_session_snapshot` RPC로
 * 단일 트랜잭션 처리한다(부분 반영 방지 — CLAUDE.md 원칙 7).
 *
 * userId는 클라이언트가 주장하는 값이 아니라 호출자(Route Handler)가 인증 세션에서
 * 뽑아 넘긴 값이어야 한다 — 이 파일 자체는 그 검증을 하지 않는다. RLS가 최종 방어선이다.
 */
export function createSupabaseSessionRepository(
  client: SupabaseClient<Database>,
): SessionRepository {
  async function getSnapshot(sessionId: string): Promise<TrainingSessionSnapshot | null> {
    const { data: sessionRow, error: sessionError } = await client
      .from("training_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!sessionRow) return null;

    const { data: observationRow, error: observationError } = await client
      .from("observations")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (observationError) throw observationError;

    const [
      observationItemsResult,
      stageResponsesResult,
      questionsResult,
      perspectivesResult,
      reframesResult,
      pdvResult,
      aiFeedbacksResult,
      coachInteractionsResult,
    ] = await Promise.all([
      observationRow
        ? client
            .from("observation_items")
            .select("*")
            .eq("observation_id", observationRow.id)
            .order("item_order", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      client
        .from("stage_responses")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }),
      client
        .from("questions")
        .select("*")
        .eq("session_id", sessionId)
        .order("question_order", { ascending: true }),
      client
        .from("perspectives")
        .select("*")
        .eq("session_id", sessionId)
        .order("perspective_order", { ascending: true }),
      client
        .from("reframes")
        .select("*")
        .eq("session_id", sessionId)
        .order("reframe_order", { ascending: true }),
      client
        .from("problem_definition_versions")
        .select("*")
        .eq("session_id", sessionId)
        .order("version_number", { ascending: true }),
      client
        .from("ai_feedbacks")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }),
      client
        .from("coach_interactions")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }),
    ]);

    for (const result of [
      observationItemsResult,
      stageResponsesResult,
      questionsResult,
      perspectivesResult,
      reframesResult,
      pdvResult,
      aiFeedbacksResult,
      coachInteractionsResult,
    ]) {
      if (result.error) throw result.error;
    }

    return {
      session: sessionRowToDomain(sessionRow),
      observation: observationRow ? observationRowToDomain(observationRow) : null,
      observationItems: (observationItemsResult.data ?? []).map(observationItemRowToDomain),
      stageResponses: (stageResponsesResult.data ?? []).map(stageResponseRowToDomain),
      questions: (questionsResult.data ?? []).map(questionRowToDomain),
      perspectives: (perspectivesResult.data ?? []).map(perspectiveRowToDomain),
      reframes: (reframesResult.data ?? []).map(reframeRowToDomain),
      problemDefinitionVersions: (pdvResult.data ?? []).map(problemDefinitionVersionRowToDomain),
      aiFeedbacks: (aiFeedbacksResult.data ?? []).map(aiFeedbackRowToDomain),
      coachInteractions: (coachInteractionsResult.data ?? []).map(coachInteractionRowToDomain),
    };
  }

  async function getActiveSessionForUser(
    userId: string,
  ): Promise<TrainingSessionSnapshot | null> {
    const { data, error } = await client
      .from("training_sessions")
      .select("id")
      .eq("user_id", userId)
      .not("status", "in", `(${ACTIVE_STATUS_FILTER.join(",")})`)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return getSnapshot(data.id);
  }

  return {
    async createSession(params: CreateSessionParams): Promise<TrainingSessionSnapshot> {
      const existing = await getActiveSessionForUser(params.userId);
      if (existing) return existing;

      const now = new Date().toISOString();
      const sessionId = crypto.randomUUID();
      const { error } = await client.from("training_sessions").insert({
        id: sessionId,
        client_generated_id: params.clientGeneratedId,
        user_id: params.userId,
        template_id: params.templateId,
        training_date: params.trainingDate,
        timezone: params.timezone,
        status: "observation",
        current_stage: "observation",
        last_active_stage: null,
        state_version: 0,
        ai_call_count: 0,
        started_at: now,
        last_active_at: now,
        created_at: now,
        updated_at: now,
      });
      if (error) throw error;

      const snapshot = await getSnapshot(sessionId);
      if (!snapshot) throw new Error("세션 생성 직후 조회에 실패했습니다");
      return snapshot;
    },

    getActiveSessionForUser,

    getSnapshot,

    async saveSnapshot(
      snapshot: TrainingSessionSnapshot,
    ): Promise<TrainingSessionSnapshot> {
      const { error } = await client.rpc("save_training_session_snapshot", {
        p_session: sessionDomainToRow(snapshot.session),
        p_observation: snapshot.observation
          ? observationDomainToRow(snapshot.observation)
          : null,
        p_observation_items: snapshot.observationItems.map(observationItemDomainToRow),
        p_stage_responses: snapshot.stageResponses.map(stageResponseDomainToRow),
        p_questions: snapshot.questions.map(questionDomainToRow),
        p_perspectives: snapshot.perspectives.map(perspectiveDomainToRow),
        p_reframes: snapshot.reframes.map(reframeDomainToRow),
        p_problem_definition_versions: snapshot.problemDefinitionVersions.map(
          problemDefinitionVersionDomainToRow,
        ),
        p_ai_feedbacks: snapshot.aiFeedbacks.map(aiFeedbackDomainToRow),
        p_coach_interactions: snapshot.coachInteractions.map(coachInteractionDomainToRow),
      });
      if (error) throw error;

      // based_on_feedback_id는 RPC 내부에서 별도 UPDATE로 채워지므로, 반환값은
      // 저장 직후 실제 DB 상태를 다시 읽어 스냅샷 정합성을 보장한다.
      const saved = await getSnapshot(snapshot.session.id);
      if (!saved) throw new Error("스냅샷 저장 직후 조회에 실패했습니다");
      return saved;
    },

    async listRecentTemplateIds(userId: string, limit: number): Promise<string[]> {
      const { data, error } = await client
        .from("training_sessions")
        .select("template_id")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((row) => row.template_id);
    },
  };
}
