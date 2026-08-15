-- 다시봄 — 초기 Daily Template 24개 시드. src/data/templates.ts(DAILY_TEMPLATES)와
-- 내용이 반드시 일치해야 한다 — 그 파일이 문구의 단일 소스다(PRD §6.6, §14-F 검수 전 초안).
-- 문구가 바뀌면 이 파일도 같이 고치고 Supabase MCP apply_migration/execute_sql로 재적용한다.
insert into public.training_templates (id, title, prompt, lens_type, difficulty, version, active) values
  ('repetition-01', '반복되는 장면', '이번 주에 똑같이 반복된 장면이 있었나요?', 'repetition', 1, 1, true),
  ('repetition-02', '몇 번째인지 세게 되는 일', '''또야?''라고 속으로 몇 번째인지 세게 되는 일이 있었나요?', 'repetition', 2, 1, true),
  ('repetition-03', '매번 같은 지점', '매번 같은 지점에서 막히는 대화나 작업이 있었나요?', 'repetition', 3, 1, true),
  ('delay-01', '계속 미루는 일', '계속 미루고 있는 일이 있었나요?', 'delay', 1, 1, true),
  ('delay-02', '예정보다 늦어진 일', '예정보다 늦어진 일이 있었다면, 무엇이 늦어졌나요?', 'delay', 2, 1, true),
  ('delay-03', '''나중에''라고 말한 일', '''나중에''라고 말해두고 아직 손대지 않은 일이 있나요?', 'delay', 3, 1, true),
  ('omission-01', '언급되지 않은 것', '누군가 언급하지 않고 넘어간 것이 있었나요?', 'omission', 1, 1, true),
  ('omission-02', '당연히 있어야 할 것', '당연히 있어야 할 것이 빠져 있던 순간이 있었나요?', 'omission', 2, 1, true),
  ('omission-03', '설명은 들었지만', '설명을 들었는데도 여전히 이해가 안 됐던 부분이 있었나요?', 'omission', 3, 1, true),
  ('goal_mismatch-01', '의도와 다르게 흘러간 일', '원래 의도와 다르게 흘러간 일이 있었나요?', 'goal_mismatch', 1, 1, true),
  ('goal_mismatch-02', '같은 목표라고 생각했지만', '다들 같은 목표라고 생각했는데 실제로는 달랐던 순간이 있었나요?', 'goal_mismatch', 2, 1, true),
  ('goal_mismatch-03', '무엇을 위한 일인지', '이게 무엇을 위한 일인지 헷갈렸던 순간이 있었나요?', 'goal_mismatch', 3, 1, true),
  ('unfair_process-01', '공평하지 않다고 느낀 순간', '과정이 공평하지 않다고 느낀 순간이 있었나요?', 'unfair_process', 1, 1, true),
  ('unfair_process-02', '다르게 적용된 규칙', '같은 규칙이 어떤 사람에게만 다르게 적용된 것을 본 적이 있나요?', 'unfair_process', 2, 1, true),
  ('unfair_process-03', '결정에 참여하지 못한 순간', '결정에 참여하지 못했지만 그 영향은 받은 순간이 있었나요?', 'unfair_process', 3, 1, true),
  ('counter_example-01', '다른 경우를 본 순간', '''원래 이런 거야''라는 말과 다른 경우를 본 적이 있나요?', 'counter_example', 1, 1, true),
  ('counter_example-02', '예외라고 했지만 반복되는 일', '예외라고 생각했는데 자꾸 반복되는 사례가 있었나요?', 'counter_example', 2, 1, true),
  ('counter_example-03', '다르게 하고 있는 곳', '다른 팀이나 다른 사람은 다르게 하고 있는 것을 본 적이 있나요?', 'counter_example', 3, 1, true),
  ('unfounded_rule-01', '원래 그렇게 해온 규칙', '''원래 그렇게 해왔다''는 이유만으로 계속되는 규칙이 있었나요?', 'unfounded_rule', 1, 1, true),
  ('unfounded_rule-02', '아무도 설명 못 하는 절차', '왜 그런지 아무도 정확히 설명하지 못하는 절차가 있었나요?', 'unfounded_rule', 2, 1, true),
  ('unfounded_rule-03', '지금은 필요 없어 보이는 규칙', '지금은 필요 없어 보이는데 여전히 남아있는 규칙이 있었나요?', 'unfounded_rule', 3, 1, true),
  ('info_timing-01', '너무 늦게 안 정보', '너무 늦게 알게 된 정보가 있었나요?', 'info_timing', 1, 1, true),
  ('info_timing-02', '미리 알았다면', '미리 알았다면 다르게 했을 것 같은 일이 있었나요?', 'info_timing', 2, 1, true),
  ('info_timing-03', '한 사람에게 먼저 전달된 정보', '정보가 한 사람에게만 먼저 전달된 순간이 있었나요?', 'info_timing', 3, 1, true)
on conflict (id) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  lens_type = excluded.lens_type,
  difficulty = excluded.difficulty,
  version = excluded.version,
  active = excluded.active;
