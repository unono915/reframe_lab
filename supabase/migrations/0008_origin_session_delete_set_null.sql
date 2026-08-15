-- Phase 5: 개별 기록 삭제(History) 완료 조건 검증 중 실제로 재현된 버그.
-- origin_session_id FK가 ON DELETE 절 없이(기본 NO ACTION) 걸려 있어, 한 번이라도
-- "다시 생각하기"(Revisit)의 원본이 된 세션은 삭제가 항상 23503으로 실패했다.
-- Revisit 세션은 그 자체로 독립된 기록이라 원본이 사라져도 존재 가치가 사라지지
-- 않는다 — origin_session_id는 "참고 정보"일 뿐이므로 ON DELETE SET NULL로 끊는다
-- (CASCADE는 안 된다 — 원본 삭제가 무관한 파생 기록까지 지우면 안 되는 삭제다).

alter table public.training_sessions
  drop constraint training_sessions_origin_session_id_fkey;

alter table public.training_sessions
  add constraint training_sessions_origin_session_id_fkey
  foreign key (origin_session_id) references public.training_sessions(id)
  on delete set null;
