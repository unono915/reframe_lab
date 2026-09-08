/**
 * DEVELOPMENT_PLAN.md §8.1: Prompt를 바꾸면 이 값을 올리고 회귀 테스트(§13.2)를
 * 통과해야 한다. 형식은 `YYYY-MM-DD.N`. 모든 `coach_interactions`/`ai_feedbacks`에
 * 저장돼 재현 가능성을 보장한다 — 이전 완료 기록을 새 Prompt로 재평가하지 않는다.
 */
// 2026-09-08.1 — question 필드의 "하나만" 제약을 프롬프트와 JSON 스키마 양쪽에
// 구체적으로(물음표 개수로) 적었다. 실측에서 복합 질문이 두 번 연속 나와
// `guardrail:multiple_questions`로 fallback된 것을 보고 고쳤다.
export const PROMPT_VERSION = "2026-09-08.1";
