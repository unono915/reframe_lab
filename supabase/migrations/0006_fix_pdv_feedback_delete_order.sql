-- 버그 수정: 재저장(두 번째 이후 saveSnapshot) 시 ai_feedbacks를 먼저 지우면
-- problem_definition_versions.based_on_feedback_id가 여전히 그 행을 참조하고 있어
-- FK 위반(23503)이 난다. ai_feedbacks.problem_definition_version_id는 ON DELETE
-- CASCADE이므로 problem_definition_versions를 먼저 지우면 관련 ai_feedbacks가 함께
-- 지워진다 — 별도 delete가 필요 없다. 실제 RPC 수동 검증(2026-08-15) 중 발견.
create or replace function public.save_training_session_snapshot(
  p_session jsonb,
  p_observation jsonb,
  p_observation_items jsonb,
  p_stage_responses jsonb,
  p_questions jsonb,
  p_perspectives jsonb,
  p_reframes jsonb,
  p_problem_definition_versions jsonb,
  p_ai_feedbacks jsonb,
  p_coach_interactions jsonb
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid := (p_session->>'id')::uuid;
  v_observation_id uuid;
begin
  insert into public.training_sessions as ts (
    id, client_generated_id, user_id, template_id, training_date, timezone,
    status, current_stage, last_active_stage, state_version, ai_call_count,
    origin_session_id, started_at, last_active_at, completed_at, abandoned_at,
    created_at, updated_at
  )
  values (
    v_session_id,
    p_session->>'client_generated_id',
    (p_session->>'user_id')::uuid,
    p_session->>'template_id',
    (p_session->>'training_date')::date,
    p_session->>'timezone',
    p_session->>'status',
    p_session->>'current_stage',
    p_session->>'last_active_stage',
    (p_session->>'state_version')::int,
    (p_session->>'ai_call_count')::int,
    nullif(p_session->>'origin_session_id', '')::uuid,
    (p_session->>'started_at')::timestamptz,
    (p_session->>'last_active_at')::timestamptz,
    nullif(p_session->>'completed_at', '')::timestamptz,
    nullif(p_session->>'abandoned_at', '')::timestamptz,
    (p_session->>'created_at')::timestamptz,
    (p_session->>'updated_at')::timestamptz
  )
  on conflict (id) do update set
    status = excluded.status,
    current_stage = excluded.current_stage,
    last_active_stage = excluded.last_active_stage,
    state_version = excluded.state_version,
    ai_call_count = excluded.ai_call_count,
    last_active_at = excluded.last_active_at,
    completed_at = excluded.completed_at,
    abandoned_at = excluded.abandoned_at,
    updated_at = excluded.updated_at;

  if p_observation is not null then
    insert into public.observations (
      id, session_id, raw_text, context_when, context_where, version, created_at, updated_at
    )
    values (
      (p_observation->>'id')::uuid, v_session_id, p_observation->>'raw_text',
      p_observation->>'context_when', p_observation->>'context_where',
      (p_observation->>'version')::int,
      (p_observation->>'created_at')::timestamptz, (p_observation->>'updated_at')::timestamptz
    )
    on conflict (session_id) do update set
      raw_text = excluded.raw_text,
      context_when = excluded.context_when,
      context_where = excluded.context_where,
      version = excluded.version,
      updated_at = excluded.updated_at
    returning id into v_observation_id;

    delete from public.observation_items where observation_id = v_observation_id;
    insert into public.observation_items (id, observation_id, text, type, author_type, user_confirmed, item_order)
    select (x->>'id')::uuid, v_observation_id, x->>'text', x->>'type', x->>'author_type',
           (x->>'user_confirmed')::boolean, (x->>'item_order')::int
    from jsonb_array_elements(p_observation_items) x;
  end if;

  delete from public.stage_responses where session_id = v_session_id;
  insert into public.stage_responses (
    id, session_id, stage, prompt_key, content, author_type, hint_level_used,
    is_draft, is_stale, version, created_at, updated_at
  )
  select (x->>'id')::uuid, v_session_id, x->>'stage', x->>'prompt_key', x->>'content', x->>'author_type',
         (x->>'hint_level_used')::smallint, (x->>'is_draft')::boolean, (x->>'is_stale')::boolean,
         (x->>'version')::int, (x->>'created_at')::timestamptz, (x->>'updated_at')::timestamptz
  from jsonb_array_elements(p_stage_responses) x;

  delete from public.questions where session_id = v_session_id;
  insert into public.questions (
    id, session_id, text, author_type, lens_type, question_order, is_priority, priority_reason, hint_level_used
  )
  select (x->>'id')::uuid, v_session_id, x->>'text', x->>'author_type', x->>'lens_type',
         (x->>'question_order')::int, (x->>'is_priority')::boolean, x->>'priority_reason',
         (x->>'hint_level_used')::smallint
  from jsonb_array_elements(p_questions) x;

  delete from public.perspectives where session_id = v_session_id;
  insert into public.perspectives (
    id, session_id, lens_type, content, author_type, perspective_order, created_at, updated_at
  )
  select (x->>'id')::uuid, v_session_id, x->>'lens_type', x->>'content', x->>'author_type',
         (x->>'perspective_order')::int, (x->>'created_at')::timestamptz, (x->>'updated_at')::timestamptz
  from jsonb_array_elements(p_perspectives) x;

  delete from public.reframes where session_id = v_session_id;
  insert into public.reframes (id, session_id, text, lens_type, author_type, reframe_order, selected_elements)
  select (x->>'id')::uuid, v_session_id, x->>'text', x->>'lens_type', x->>'author_type',
         (x->>'reframe_order')::int,
         case when x->'selected_elements' is null or jsonb_typeof(x->'selected_elements') = 'null' then null
              else array(select jsonb_array_elements_text(x->'selected_elements')) end
  from jsonb_array_elements(p_reframes) x;

  -- ai_feedbacks.problem_definition_version_id → problem_definition_versions(id)는
  -- ON DELETE CASCADE이므로, problem_definition_versions를 먼저 지우면 관련 ai_feedbacks가
  -- 자동으로 함께 지워진다. 반대 순서(ai_feedbacks를 먼저 지우기)는 여전히 남아있는
  -- problem_definition_versions.based_on_feedback_id 참조 때문에 FK 위반으로 실패한다
  -- (RESTRICT가 기본값 — 이 방향은 순환을 깨기 위해 CASCADE를 주지 않았다).
  delete from public.problem_definition_versions where session_id = v_session_id;

  insert into public.problem_definition_versions (
    id, session_id, version_number, text, author_type, change_reason, based_on_feedback_id, created_at
  )
  select (x->>'id')::uuid, v_session_id, (x->>'version_number')::int, x->>'text', x->>'author_type',
         x->>'change_reason', null, (x->>'created_at')::timestamptz
  from jsonb_array_elements(p_problem_definition_versions) x;

  insert into public.ai_feedbacks (
    id, session_id, problem_definition_version_id, dimensions, strength, improvement_focus,
    unverified_assumption, next_question, provider, model, prompt_version, schema_version,
    is_stale, created_at
  )
  select (x->>'id')::uuid, v_session_id, (x->>'problem_definition_version_id')::uuid, x->'dimensions',
         x->>'strength', x->>'improvement_focus', x->>'unverified_assumption', x->>'next_question',
         x->>'provider', x->>'model', x->>'prompt_version', x->>'schema_version',
         (x->>'is_stale')::boolean, (x->>'created_at')::timestamptz
  from jsonb_array_elements(p_ai_feedbacks) x;

  update public.problem_definition_versions pdv
  set based_on_feedback_id = (x->>'based_on_feedback_id')::uuid
  from jsonb_array_elements(p_problem_definition_versions) x
  where pdv.id = (x->>'id')::uuid
    and x->>'based_on_feedback_id' is not null
    and x->>'based_on_feedback_id' != '';

  delete from public.coach_interactions where session_id = v_session_id;
  insert into public.coach_interactions (
    id, session_id, stage, validated_output, action, hint_level, provider, model,
    prompt_version, schema_version, latency_ms, status, error_code, is_stale, created_at
  )
  select (x->>'id')::uuid, v_session_id, x->>'stage', x->'validated_output', x->>'action',
         (x->>'hint_level')::smallint, x->>'provider', x->>'model', x->>'prompt_version', x->>'schema_version',
         (x->>'latency_ms')::int, x->>'status', x->>'error_code', (x->>'is_stale')::boolean,
         (x->>'created_at')::timestamptz
  from jsonb_array_elements(p_coach_interactions) x;
end;
$$;
