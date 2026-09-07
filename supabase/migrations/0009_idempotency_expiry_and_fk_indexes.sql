-- 다시봄 — 저장소 증가 억제 + 핫패스 인덱스 보강 (2026-09-08 성능 점검)
--
-- 배경: Supabase performance advisor와 실제 테이블 통계를 함께 본 결과 두 가지가 나왔다.
--
-- 1) idempotency_keys가 무한히 자란다. 솔로 테스트 18일 만에 2,154행(응답 본문
--    평균 1.6KB)이 쌓였고 만료·정리 로직이 아예 없었다. 멱등성 키는 "같은 요청이
--    재시도로 두 번 오는" 짧은 창을 막으려는 것이라 하루를 넘겨 보관할 이유가 없다.
--    무료 티어 용량 한계도 있어 방치하면 실제로 문제가 된다.
--
-- 2) FK 두 개에 커버링 인덱스가 없다. 특히 problem_definition_versions.
--    based_on_feedback_id는 save_training_session_snapshot RPC가 **매 저장마다**
--    ai_feedbacks를 지우면서(pdv 삭제의 CASCADE) 참조 검사를 유발하는 자리다 —
--    인덱스가 없으면 저장 한 번마다 pdv 순차 스캔이 붙는다. 지금은 행이 4개라
--    보이지 않지만 매일 쓰는 앱이라 선형으로 나빠진다.
--
-- 두 컬럼 모두 대부분 NULL이라 부분 인덱스로 만든다 — FK 검사는 항상 특정 값을
-- 찾으므로(NULL 조회가 아니다) 부분 인덱스로 충분하고 크기가 훨씬 작다.
--
-- advisor가 함께 지적한 training_sessions_user_date_idx·user_status_idx의
-- "미사용"은 따르지 않는다. 행이 39개뿐이라 플래너가 항상 순차 스캔을 고르는 것이지
-- 인덱스가 불필요해서가 아니다. 두 인덱스 모두 앱의 실제 조회 경로
-- (활성 세션 1개 조회, 사용자별 최신순 목록)를 그대로 덮는다.
-- training_sessions_template_id_fkey도 인덱스를 만들지 않는다 — 템플릿은 시드
-- 데이터라 삭제되지 않고, 앱에 template_id로 거르는 조회 경로가 없다. 반면
-- training_sessions는 매 저장마다 UPDATE되므로 쓰기 비용만 늘어난다.

create index if not exists problem_definition_versions_based_on_feedback_idx
  on public.problem_definition_versions (based_on_feedback_id)
  where based_on_feedback_id is not null;

create index if not exists training_sessions_origin_session_idx
  on public.training_sessions (origin_session_id)
  where origin_session_id is not null;

-- 만료 시각을 행에 직접 둔다. 정리 작업이 멈춰도 조회 쪽에서 만료된 키를 무시할 수
-- 있어야 오래된 응답이 되살아나지 않는다(lib/idempotency.ts가 이 컬럼을 본다).
alter table public.idempotency_keys
  add column if not exists expires_at timestamptz not null default (now() + interval '24 hours');

create index if not exists idempotency_keys_expires_at_idx
  on public.idempotency_keys (expires_at);

-- 기존에 쌓인 행에도 만료 시각을 소급 부여한다(created_at 기준 24시간).
update public.idempotency_keys
   set expires_at = created_at + interval '24 hours'
 where expires_at > created_at + interval '24 hours';

create extension if not exists pg_cron;

/**
 * 만료된 멱등성 키를 지운다. RLS를 우회해야 모든 사용자의 행을 정리할 수 있으므로
 * SECURITY DEFINER다 — 대신 하는 일이 만료 행 삭제 하나뿐이고 인자를 받지 않는다.
 */
create or replace function public.purge_expired_idempotency_keys()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  delete from public.idempotency_keys where expires_at <= now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_idempotency_keys() from public, anon, authenticated;

select cron.schedule(
  'purge-expired-idempotency-keys',
  '17 * * * *',
  $$select public.purge_expired_idempotency_keys()$$
);
