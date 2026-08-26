import type { HintLevel, Stage, TrainingSessionSnapshot } from "@/domain/types";
import type { CoachRequestContext } from "./provider";

/**
 * AI에 보낼 최소 Context를 구성한다 (DEVELOPMENT_PLAN.md §8.7). 현재 단계에 필요한
 * 사용자 원문만 골라 담는다 — 전체 History, 다른 세션, 이전 단계 중 지금 질문과
 * 무관한 내용, 사용자 식별 정보(이메일 등)는 절대 포함하지 않는다. 이 함수가 반환한
 * `userText`는 시스템 프롬프트와 분리된 "데이터"로만 다뤄진다(prompts/common.ts
 * 5번 "입력 격리") — 이 파일이 그 경계의 실제 구현이다.
 */
export function buildCoachContext(
  stage: Exclude<Stage, "not_started">,
  snapshot: TrainingSessionSnapshot,
  hintLevel: HintLevel,
): CoachRequestContext {
  return {
    stage,
    hintLevel,
    userText: extractCurrentStageText(stage, snapshot),
    recentQuestions: recentQuestionTexts(stage, snapshot),
  };
}

function extractCurrentStageText(
  stage: Exclude<Stage, "not_started">,
  snapshot: TrainingSessionSnapshot,
): string {
  switch (stage) {
    case "observation":
      return snapshot.observation?.rawText ?? "";
    case "separation":
      return snapshot.observationItems
        .filter((i) => i.userConfirmed)
        .map((i) => `[${i.type}] ${i.text}`)
        .join("\n");
    case "questioning":
      return snapshot.questions
        .filter((q) => q.authorType === "user")
        .map((q) => q.text)
        .join("\n");
    case "exploration":
      return snapshot.stageResponses
        .filter((r) => r.stage === "exploration" && !r.isDraft)
        .map((r) => `[${r.promptKey}] ${r.content}`)
        .join("\n");
    case "reframing":
      return [
        ...snapshot.perspectives.filter((p) => p.authorType === "user").map((p) => p.content),
        ...snapshot.reframes.filter((r) => r.authorType === "user").map((r) => r.text),
      ].join("\n");
    case "definition":
    case "feedback": {
      const latest = [...snapshot.problemDefinitionVersions].sort(
        (a, b) => b.versionNumber - a.versionNumber,
      )[0];
      return latest?.text ?? "";
    }
  }
}

/** 반복 질문 검사(guardrails.ts 8번)에 쓸 최근 유효 질문 1~2개 — 힌트 관련 산출물만. */
function recentQuestionTexts(
  stage: Exclude<Stage, "not_started">,
  snapshot: TrainingSessionSnapshot,
): string[] {
  return snapshot.coachInteractions
    .filter((ci) => ci.stage === stage && !ci.isStale)
    .slice(-2)
    .map((ci) => {
      const output = ci.validatedOutput as { question?: string | null } | null;
      return output?.question ?? "";
    })
    .filter((q) => q.length > 0);
}
