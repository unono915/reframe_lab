import type { Stage } from "@/domain/types";
import { COMMON_SYSTEM_PROMPT } from "./common";
import { DEFINITION_STAGE_PROMPT } from "./stages/definition";
import { EXPLORATION_STAGE_PROMPT } from "./stages/exploration";
import { FEEDBACK_STAGE_PROMPT } from "./stages/feedback";
import { OBSERVATION_STAGE_PROMPT } from "./stages/observation";
import { QUESTIONING_STAGE_PROMPT } from "./stages/questioning";
import { REFRAMING_STAGE_PROMPT } from "./stages/reframing";
import { SEPARATION_STAGE_PROMPT } from "./stages/separation";

export { PROMPT_VERSION } from "./version";

const STAGE_PROMPTS: Record<Exclude<Stage, "not_started">, string> = {
  observation: OBSERVATION_STAGE_PROMPT,
  separation: SEPARATION_STAGE_PROMPT,
  questioning: QUESTIONING_STAGE_PROMPT,
  exploration: EXPLORATION_STAGE_PROMPT,
  reframing: REFRAMING_STAGE_PROMPT,
  definition: DEFINITION_STAGE_PROMPT,
  feedback: FEEDBACK_STAGE_PROMPT,
};

/**
 * 층 1(공통) + 층 2(단계별)을 합친다. 순서 고정 — §8.7: 시스템 원칙 → 현재 단계
 * 규칙 → (호출자가 이어붙일) 금지 행동 요약 → 출력 Schema → 사용자 데이터.
 * 사용자 데이터를 여기 넣지 않는 것 자체가 입력 격리의 일부다(`context.ts`가 담당).
 */
export function buildSystemPrompt(stage: Exclude<Stage, "not_started">): string {
  return `${COMMON_SYSTEM_PROMPT}\n\n${STAGE_PROMPTS[stage]}`;
}
