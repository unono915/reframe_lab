-- security advisor: function_search_path_mutable 경고 해소.
alter function public.save_training_session_snapshot(
  jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) set search_path = public, pg_temp;
