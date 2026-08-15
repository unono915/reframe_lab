-- 다시봄 — 핵심 스키마 (DEVELOPMENT_PLAN.md §6 물리 모델을 그대로 옮김)
-- 모든 시각은 timestamptz(UTC). 사용자 시간대는 training_sessions.timezone에 별도 보존.
-- Enum은 domain/types.ts가 단일 소스 — CHECK 제약의 값은 그 파일과 1:1로 맞춘다.

-- ── training_templates ────────────────────────────────────────────────
create table public.training_templates (
  id text primary key,
  title text not null,
  prompt text not null,
  lens_type text not null check (lens_type in (
    'repetition', 'delay', 'omission', 'goal_mismatch',
    'unfair_process', 'counter_example', 'unfounded_rule', 'info_timing'
  )),
  difficulty smallint not null check (difficulty between 1 and 3),
  version int not null default 1,
  active boolean not null default true
);

-- ── training_sessions ─────────────────────────────────────────────────
create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  client_generated_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id text not null references public.training_templates(id),
  training_date date not null,
  timezone text not null,
  status text not null check (status in (
    'observation', 'separation', 'questioning', 'exploration',
    'reframing', 'definition', 'feedback', 'completed', 'paused', 'abandoned'
  )),
  current_stage text not null check (current_stage in (
    'not_started', 'observation', 'separation', 'questioning',
    'exploration', 'reframing', 'definition', 'feedback'
  )),
  last_active_stage text check (last_active_stage in (
    'not_started', 'observation', 'separation', 'questioning',
    'exploration', 'reframing', 'definition', 'feedback'
  )),
  state_version int not null default 0,
  ai_call_count int not null default 0,
  origin_session_id uuid references public.training_sessions(id),
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  completed_at timestamptz,
  abandoned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_generated_id)
);

create index training_sessions_user_date_idx
  on public.training_sessions (user_id, training_date desc);
create index training_sessions_user_status_idx
  on public.training_sessions (user_id, status);

-- 활성 세션(완료·포기 아님)은 사용자당 최대 1개 — PRD 제약을 DB 레벨로 강제.
create unique index training_sessions_one_active_per_user
  on public.training_sessions (user_id)
  where status not in ('completed', 'abandoned');

-- ── observations (세션과 1:1) ─────────────────────────────────────────
create table public.observations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.training_sessions(id) on delete cascade,
  raw_text text not null default '',
  context_when text,
  context_where text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── observation_items ─────────────────────────────────────────────────
create table public.observation_items (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.observations(id) on delete cascade,
  text text not null,
  type text not null check (type in ('fact', 'interpretation', 'assumption', 'emotion', 'solution')),
  author_type text not null check (author_type in ('user', 'ai', 'system_template')),
  user_confirmed boolean not null default false,
  item_order int not null default 0
);

create index observation_items_observation_idx
  on public.observation_items (observation_id);

-- ── stage_responses ───────────────────────────────────────────────────
create table public.stage_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  stage text not null check (stage in (
    'observation', 'separation', 'questioning', 'exploration',
    'reframing', 'definition', 'feedback'
  )),
  prompt_key text not null,
  content text not null default '',
  author_type text not null check (author_type in ('user', 'ai', 'system_template')),
  hint_level_used smallint not null default 0 check (hint_level_used in (0, 1, 2)),
  is_draft boolean not null default false,
  is_stale boolean not null default false,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stage_responses_session_idx
  on public.stage_responses (session_id);

-- ── questions ──────────────────────────────────────────────────────────
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  text text not null,
  author_type text not null check (author_type in ('user', 'ai', 'system_template')),
  lens_type text check (lens_type in (
    'person', 'situation', 'time', 'impact', 'counter_example',
    'cause_hypothesis', 'evidence', 'boundary'
  )),
  question_order int not null default 0,
  is_priority boolean not null default false,
  priority_reason text,
  hint_level_used smallint not null default 0 check (hint_level_used in (0, 1, 2))
);

create index questions_session_idx
  on public.questions (session_id);

-- ── perspectives ───────────────────────────────────────────────────────
create table public.perspectives (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  lens_type text not null check (lens_type in (
    'stakeholder', 'timeframe', 'scope', 'structure',
    'counter_example', 'causality', 'most_disadvantaged'
  )),
  content text not null,
  author_type text not null check (author_type in ('user', 'ai', 'system_template')),
  perspective_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index perspectives_session_idx
  on public.perspectives (session_id);

-- ── reframes ───────────────────────────────────────────────────────────
create table public.reframes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  text text not null,
  lens_type text check (lens_type in (
    'stakeholder', 'timeframe', 'scope', 'structure',
    'counter_example', 'causality', 'most_disadvantaged'
  )),
  author_type text not null check (author_type in ('user', 'ai', 'system_template')),
  reframe_order int not null default 0,
  selected_elements text[]
);

create index reframes_session_idx
  on public.reframes (session_id);

-- ── problem_definition_versions ──────────────────────────────────────
create table public.problem_definition_versions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  version_number int not null,
  text text not null,
  author_type text not null check (author_type in ('user', 'ai', 'system_template')),
  change_reason text,
  based_on_feedback_id uuid,
  created_at timestamptz not null default now(),
  unique (session_id, version_number)
);

create index problem_definition_versions_session_idx
  on public.problem_definition_versions (session_id);

-- ── ai_feedbacks ───────────────────────────────────────────────────────
create table public.ai_feedbacks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  problem_definition_version_id uuid not null
    references public.problem_definition_versions(id) on delete cascade,
  dimensions jsonb not null,
  strength text not null,
  improvement_focus text not null,
  unverified_assumption text not null,
  next_question text not null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  schema_version text not null,
  is_stale boolean not null default false,
  created_at timestamptz not null default now()
);

create index ai_feedbacks_session_idx
  on public.ai_feedbacks (session_id);
create index ai_feedbacks_pdv_idx
  on public.ai_feedbacks (problem_definition_version_id);

alter table public.problem_definition_versions
  add constraint problem_definition_versions_based_on_feedback_fk
  foreign key (based_on_feedback_id) references public.ai_feedbacks(id);

-- ── coach_interactions ────────────────────────────────────────────────
create table public.coach_interactions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  stage text not null check (stage in (
    'observation', 'separation', 'questioning', 'exploration',
    'reframing', 'definition', 'feedback'
  )),
  validated_output jsonb not null,
  action text not null,
  hint_level smallint not null default 0 check (hint_level in (0, 1, 2)),
  provider text not null,
  model text not null,
  prompt_version text not null,
  schema_version text not null,
  latency_ms int not null,
  status text not null check (status in ('ok', 'error', 'fallback')),
  error_code text,
  is_stale boolean not null default false,
  created_at timestamptz not null default now()
);

create index coach_interactions_session_idx
  on public.coach_interactions (session_id);

-- ── session_events ─────────────────────────────────────────────────────
create table public.session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  event_type text not null check (event_type in (
    'started', 'stage_completed', 'resumed', 'paused',
    'abandoned', 'completed', 'revisited'
  )),
  stage text not null check (stage in (
    'not_started', 'observation', 'separation', 'questioning',
    'exploration', 'reframing', 'definition', 'feedback'
  )),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index session_events_session_idx
  on public.session_events (session_id);
