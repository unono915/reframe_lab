-- 다시봄 — RLS 정책 (DEVELOPMENT_PLAN.md §6.3 원칙 5: 기본 거부 후 user_id = auth.uid()만 허용)
-- 전 테이블 RLS 활성화. 정책이 없으면 기본적으로 모든 접근이 거부된다.
-- 소유권은 training_sessions.user_id를 기준으로 하고, 자식 테이블은 session_id(또는
-- observation_id)를 거쳐 training_sessions까지 조인해 확인한다.

-- ── training_templates: 인증 사용자 전원 SELECT 허용, 쓰기는 앱에서 불가 ──
alter table public.training_templates enable row level security;

create policy training_templates_select_authenticated
  on public.training_templates
  for select
  to authenticated
  using (true);

-- ── training_sessions: 소유자만 CRUD ──────────────────────────────────
alter table public.training_sessions enable row level security;

create policy training_sessions_owner_all
  on public.training_sessions
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── observations: session_id를 거쳐 소유권 확인 ───────────────────────
alter table public.observations enable row level security;

create policy observations_owner_all
  on public.observations
  for all
  to authenticated
  using (exists (
    select 1 from public.training_sessions ts
    where ts.id = observations.session_id and ts.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.training_sessions ts
    where ts.id = observations.session_id and ts.user_id = (select auth.uid())
  ));

-- ── observation_items: observation_id → observations.session_id 2단 조인 ──
alter table public.observation_items enable row level security;

create policy observation_items_owner_all
  on public.observation_items
  for all
  to authenticated
  using (exists (
    select 1 from public.observations o
    join public.training_sessions ts on ts.id = o.session_id
    where o.id = observation_items.observation_id and ts.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.observations o
    join public.training_sessions ts on ts.id = o.session_id
    where o.id = observation_items.observation_id and ts.user_id = (select auth.uid())
  ));

-- ── session_id를 직접 갖는 나머지 자식 테이블 공통 패턴 ────────────────
alter table public.stage_responses enable row level security;

create policy stage_responses_owner_all
  on public.stage_responses
  for all
  to authenticated
  using (exists (
    select 1 from public.training_sessions ts
    where ts.id = stage_responses.session_id and ts.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.training_sessions ts
    where ts.id = stage_responses.session_id and ts.user_id = (select auth.uid())
  ));

alter table public.questions enable row level security;

create policy questions_owner_all
  on public.questions
  for all
  to authenticated
  using (exists (
    select 1 from public.training_sessions ts
    where ts.id = questions.session_id and ts.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.training_sessions ts
    where ts.id = questions.session_id and ts.user_id = (select auth.uid())
  ));

alter table public.perspectives enable row level security;

create policy perspectives_owner_all
  on public.perspectives
  for all
  to authenticated
  using (exists (
    select 1 from public.training_sessions ts
    where ts.id = perspectives.session_id and ts.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.training_sessions ts
    where ts.id = perspectives.session_id and ts.user_id = (select auth.uid())
  ));

alter table public.reframes enable row level security;

create policy reframes_owner_all
  on public.reframes
  for all
  to authenticated
  using (exists (
    select 1 from public.training_sessions ts
    where ts.id = reframes.session_id and ts.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.training_sessions ts
    where ts.id = reframes.session_id and ts.user_id = (select auth.uid())
  ));

alter table public.problem_definition_versions enable row level security;

create policy problem_definition_versions_owner_all
  on public.problem_definition_versions
  for all
  to authenticated
  using (exists (
    select 1 from public.training_sessions ts
    where ts.id = problem_definition_versions.session_id and ts.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.training_sessions ts
    where ts.id = problem_definition_versions.session_id and ts.user_id = (select auth.uid())
  ));

alter table public.ai_feedbacks enable row level security;

create policy ai_feedbacks_owner_all
  on public.ai_feedbacks
  for all
  to authenticated
  using (exists (
    select 1 from public.training_sessions ts
    where ts.id = ai_feedbacks.session_id and ts.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.training_sessions ts
    where ts.id = ai_feedbacks.session_id and ts.user_id = (select auth.uid())
  ));

alter table public.coach_interactions enable row level security;

create policy coach_interactions_owner_all
  on public.coach_interactions
  for all
  to authenticated
  using (exists (
    select 1 from public.training_sessions ts
    where ts.id = coach_interactions.session_id and ts.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.training_sessions ts
    where ts.id = coach_interactions.session_id and ts.user_id = (select auth.uid())
  ));

alter table public.session_events enable row level security;

create policy session_events_owner_all
  on public.session_events
  for all
  to authenticated
  using (exists (
    select 1 from public.training_sessions ts
    where ts.id = session_events.session_id and ts.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.training_sessions ts
    where ts.id = session_events.session_id and ts.user_id = (select auth.uid())
  ));
