import type { TrainingTemplate } from "@/domain/types";

/**
 * 초기 Daily Template 24개 (8 렌즈 × 3). PRD §6.6, DEVELOPMENT_PLAN.md §14-F.
 *
 * ⚠️ 문구는 초안이다. §14-F(Human Input)가 검수하기 전까지 임시로 사용한다 — 검수 후에는
 * `version`을 올리고 문구만 교체한다(구조·id는 유지). 관리자 화면은 MVP 범위 밖이라
 * 이 파일이 유일한 편집 지점이다(PRD §6.6).
 */
export const DAILY_TEMPLATES: TrainingTemplate[] = [
  // repetition — 계속 반복되는 장면
  {
    id: "repetition-01",
    title: "반복되는 장면",
    prompt: "이번 주에 똑같이 반복된 장면이 있었나요?",
    lensType: "repetition",
    difficulty: 1,
    version: 1,
    active: true,
  },
  {
    id: "repetition-02",
    title: "몇 번째인지 세게 되는 일",
    prompt: "'또야?'라고 속으로 몇 번째인지 세게 되는 일이 있었나요?",
    lensType: "repetition",
    difficulty: 2,
    version: 1,
    active: true,
  },
  {
    id: "repetition-03",
    title: "매번 같은 지점",
    prompt: "매번 같은 지점에서 막히는 대화나 작업이 있었나요?",
    lensType: "repetition",
    difficulty: 3,
    version: 1,
    active: true,
  },

  // delay — 계속 미뤄지는 것
  {
    id: "delay-01",
    title: "계속 미루는 일",
    prompt: "계속 미루고 있는 일이 있었나요?",
    lensType: "delay",
    difficulty: 1,
    version: 1,
    active: true,
  },
  {
    id: "delay-02",
    title: "예정보다 늦어진 일",
    prompt: "예정보다 늦어진 일이 있었다면, 무엇이 늦어졌나요?",
    lensType: "delay",
    difficulty: 2,
    version: 1,
    active: true,
  },
  {
    id: "delay-03",
    title: "'나중에'라고 말한 일",
    prompt: "'나중에'라고 말해두고 아직 손대지 않은 일이 있나요?",
    lensType: "delay",
    difficulty: 3,
    version: 1,
    active: true,
  },

  // omission — 빠진 것, 놓친 것
  {
    id: "omission-01",
    title: "언급되지 않은 것",
    prompt: "누군가 언급하지 않고 넘어간 것이 있었나요?",
    lensType: "omission",
    difficulty: 1,
    version: 1,
    active: true,
  },
  {
    id: "omission-02",
    title: "당연히 있어야 할 것",
    prompt: "당연히 있어야 할 것이 빠져 있던 순간이 있었나요?",
    lensType: "omission",
    difficulty: 2,
    version: 1,
    active: true,
  },
  {
    id: "omission-03",
    title: "설명은 들었지만",
    prompt: "설명을 들었는데도 여전히 이해가 안 됐던 부분이 있었나요?",
    lensType: "omission",
    difficulty: 3,
    version: 1,
    active: true,
  },

  // goal_mismatch — 목표가 어긋난 순간
  {
    id: "goal_mismatch-01",
    title: "의도와 다르게 흘러간 일",
    prompt: "원래 의도와 다르게 흘러간 일이 있었나요?",
    lensType: "goal_mismatch",
    difficulty: 1,
    version: 1,
    active: true,
  },
  {
    id: "goal_mismatch-02",
    title: "같은 목표라고 생각했지만",
    prompt: "다들 같은 목표라고 생각했는데 실제로는 달랐던 순간이 있었나요?",
    lensType: "goal_mismatch",
    difficulty: 2,
    version: 1,
    active: true,
  },
  {
    id: "goal_mismatch-03",
    title: "무엇을 위한 일인지",
    prompt: "이게 무엇을 위한 일인지 헷갈렸던 순간이 있었나요?",
    lensType: "goal_mismatch",
    difficulty: 3,
    version: 1,
    active: true,
  },

  // unfair_process — 과정이 공평하지 않다고 느낀 순간
  {
    id: "unfair_process-01",
    title: "공평하지 않다고 느낀 순간",
    prompt: "과정이 공평하지 않다고 느낀 순간이 있었나요?",
    lensType: "unfair_process",
    difficulty: 1,
    version: 1,
    active: true,
  },
  {
    id: "unfair_process-02",
    title: "다르게 적용된 규칙",
    prompt: "같은 규칙이 어떤 사람에게만 다르게 적용된 것을 본 적이 있나요?",
    lensType: "unfair_process",
    difficulty: 2,
    version: 1,
    active: true,
  },
  {
    id: "unfair_process-03",
    title: "결정에 참여하지 못한 순간",
    prompt: "결정에 참여하지 못했지만 그 영향은 받은 순간이 있었나요?",
    lensType: "unfair_process",
    difficulty: 3,
    version: 1,
    active: true,
  },

  // counter_example — '원래 이런 거야'와 다른 사례
  {
    id: "counter_example-01",
    title: "다른 경우를 본 순간",
    prompt: "'원래 이런 거야'라는 말과 다른 경우를 본 적이 있나요?",
    lensType: "counter_example",
    difficulty: 1,
    version: 1,
    active: true,
  },
  {
    id: "counter_example-02",
    title: "예외라고 했지만 반복되는 일",
    prompt: "예외라고 생각했는데 자꾸 반복되는 사례가 있었나요?",
    lensType: "counter_example",
    difficulty: 2,
    version: 1,
    active: true,
  },
  {
    id: "counter_example-03",
    title: "다르게 하고 있는 곳",
    prompt: "다른 팀이나 다른 사람은 다르게 하고 있는 것을 본 적이 있나요?",
    lensType: "counter_example",
    difficulty: 3,
    version: 1,
    active: true,
  },

  // unfounded_rule — 근거를 아무도 설명 못 하는 규칙
  {
    id: "unfounded_rule-01",
    title: "원래 그렇게 해온 규칙",
    prompt: "'원래 그렇게 해왔다'는 이유만으로 계속되는 규칙이 있었나요?",
    lensType: "unfounded_rule",
    difficulty: 1,
    version: 1,
    active: true,
  },
  {
    id: "unfounded_rule-02",
    title: "아무도 설명 못 하는 절차",
    prompt: "왜 그런지 아무도 정확히 설명하지 못하는 절차가 있었나요?",
    lensType: "unfounded_rule",
    difficulty: 2,
    version: 1,
    active: true,
  },
  {
    id: "unfounded_rule-03",
    title: "지금은 필요 없어 보이는 규칙",
    prompt: "지금은 필요 없어 보이는데 여전히 남아있는 규칙이 있었나요?",
    lensType: "unfounded_rule",
    difficulty: 3,
    version: 1,
    active: true,
  },

  // info_timing — 정보가 전달된 시점의 문제
  {
    id: "info_timing-01",
    title: "너무 늦게 안 정보",
    prompt: "너무 늦게 알게 된 정보가 있었나요?",
    lensType: "info_timing",
    difficulty: 1,
    version: 1,
    active: true,
  },
  {
    id: "info_timing-02",
    title: "미리 알았다면",
    prompt: "미리 알았다면 다르게 했을 것 같은 일이 있었나요?",
    lensType: "info_timing",
    difficulty: 2,
    version: 1,
    active: true,
  },
  {
    id: "info_timing-03",
    title: "한 사람에게 먼저 전달된 정보",
    prompt: "정보가 한 사람에게만 먼저 전달된 순간이 있었나요?",
    lensType: "info_timing",
    difficulty: 3,
    version: 1,
    active: true,
  },
];
