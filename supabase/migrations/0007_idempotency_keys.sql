-- 다시봄 — 멱등성 키. 같은 clientRequestId로 두 번 요청이 오면(연속 클릭, 네트워크
-- 재시도) 두 번째 요청은 처리하지 않고 첫 번째 응답을 그대로 돌려준다
-- (DEVELOPMENT_PLAN.md §7.3 3번 단계, 완료 조건 "같은 요청 2회 전송 시 중복 레코드 생성 안 됨").
create table public.idempotency_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id text not null,
  response_status smallint not null,
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, client_request_id)
);

alter table public.idempotency_keys enable row level security;

create policy idempotency_keys_owner_all
  on public.idempotency_keys
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
