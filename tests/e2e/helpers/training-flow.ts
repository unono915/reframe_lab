import { expect, type Page } from "@playwright/test";

/**
 * 7단계 훈련 플로우를 E2E에서 재사용하는 조작 헬퍼.
 *
 * 원래는 spec 3개가 같은 25줄짜리 절차를 각자 복사해 갖고 있었다. 그러다 P0-2에서
 * 자기 점검 UI가 체크박스에서 세그먼트로 바뀌자 **세 곳이 한꺼번에 깨졌고, 아무도
 * 그걸 눈치채지 못한 채 2주 가까이 지났다**(2026-09-08 발견). 화면이 바뀌면 고칠
 * 자리가 한 곳이도록 여기로 모은다.
 */

/** 각 단계 진입 직후의 짧은 안정화 — mount 직후 초안 복구 useEffect와 첫 입력이 겹치는 것을 피한다. */
export async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(200);
}

export const SELF_CHECK_LABELS = [
  "실제 장면이나 확인된 사실에서 출발했나요?",
  "누가 어떤 상황에서 겪는 문제인지 드러나나요?",
  "원하는 것과 방해 요소, 결과가 구분되나요?",
  "확인되지 않은 원인을 단정하지 않았나요?",
  "지나치게 넓거나 특정 해결책으로 고정되지 않았나요?",
  "무엇을 더 확인해야 하는지 알 수 있나요?",
] as const;

export type SelfCheckAnswer = "드러나 있어요" | "아직이에요";

export interface TrainingContent {
  observation: string;
  observationItem: string;
  questions: [string, string, string];
  priorityReason: string;
  exploration: { affected: string; context: string; impact: string; unknown: string };
  reframes: [string, string];
  definition: string;
}

export const DEFAULT_CONTENT: TrainingContent = {
  observation: "회의 때마다 한 사람이 항상 10분씩 늦게 들어온다",
  observationItem: "지난 3번의 회의에서 10분 이상 늦었다",
  questions: [
    "왜 이 사람만 늦을까?",
    "다른 사람도 같은 경험을 했을까?",
    "회의 시간을 바꾸면 나아질까?",
  ],
  priorityReason: "가장 반복적으로 발생하기 때문",
  exploration: {
    affected: "늦게 오는 사람 본인과 나머지 참석자들",
    context: "매주 월요일 정기 회의",
    impact: "회의 시작이 늦어져 다음 일정이 밀린다",
    unknown: "모르겠다",
  },
  reframes: [
    "회의 시작 시각과 이동 동선이 맞지 않는 것이 문제일 수 있다",
    "지각 자체보다 회의 시작을 알리는 방식이 문제일 수 있다",
  ],
  definition: "회의 시작 시각과 참석자 이동 동선이 맞지 않아 반복 지각이 발생하고 있다",
};

/** 1~2단계(관찰·구분)를 채워 3단계 '질문' 진입까지만 진행한다. 힌트 경로 테스트용. */
export async function fillStagesUntilQuestioning(
  page: Page,
  content: TrainingContent = DEFAULT_CONTENT,
): Promise<void> {
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await settle(page);
  await page.getByLabel("관찰한 장면").fill(content.observation);
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("2 / 7 구분")).toBeVisible();
  await settle(page);
  await page.getByLabel("추가할 항목").fill(content.observationItem);
  await page.getByRole("button", { name: "항목 추가하기" }).click();
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("3 / 7 질문")).toBeVisible();
  await settle(page);
}

/**
 * 1~6단계(관찰 → 정의)를 채워 7단계 '돌아보기' 진입까지 진행한다.
 * 돌아보기 안에서 무엇을 할지는 호출자가 정한다(자기 점검만 / AI 피드백까지).
 */
export async function fillStagesUntilFeedback(
  page: Page,
  content: TrainingContent = DEFAULT_CONTENT,
): Promise<void> {
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await settle(page);
  await page.getByLabel("관찰한 장면").fill(content.observation);
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("2 / 7 구분")).toBeVisible();
  await settle(page);
  await page.getByLabel("추가할 항목").fill(content.observationItem);
  await page.getByRole("button", { name: "항목 추가하기" }).click();
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("3 / 7 질문")).toBeVisible();
  await settle(page);
  const questionField = page.getByLabel("새 질문");
  for (const q of content.questions) {
    await questionField.fill(q);
    await page.getByRole("button", { name: "질문 추가하기" }).click();
  }
  await page.getByRole("button", { name: "핵심 질문으로 고르기" }).first().click();
  await page.getByLabel("이 질문을 고른 이유").fill(content.priorityReason);
  await page.getByRole("button", { name: "핵심 질문으로 선택" }).click();
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("4 / 7 탐색")).toBeVisible();
  await settle(page);
  await page.getByLabel(/가장 직접적인 영향을 받는 사람/).fill(content.exploration.affected);
  await page.getByLabel(/어떤 상황·맥락/).fill(content.exploration.context);
  await page.getByLabel(/무엇이 어렵거나 달라졌나요/).fill(content.exploration.impact);
  await page.getByLabel(/아직 확실히 모르는 부분/).fill(content.exploration.unknown);
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("5 / 7 재정의")).toBeVisible();
  await settle(page);
  const reframeField = page.getByLabel("대안 문제 프레임");
  for (const r of content.reframes) {
    await reframeField.fill(r);
    await page.getByRole("button", { name: "프레임 추가하기" }).click();
  }
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("6 / 7 정의")).toBeVisible();
  await settle(page);
  await page.getByLabel("현재의 문제 정의").fill(content.definition);
  await page.getByRole("button", { name: "이대로 기록하기" }).click();

  await expect(page.getByText("7 / 7 돌아보기")).toBeVisible();
  await settle(page);
}

/**
 * 자기 점검 6문항에 답하고 저장한다(P0-2). 라디오 입력은 `sr-only`라 직접
 * check()할 수 없으므로, 실제 사용자와 같이 보이는 선택지 라벨을 누른다.
 */
export async function completeSelfAssessment(
  page: Page,
  answer: SelfCheckAnswer = "드러나 있어요",
): Promise<void> {
  for (const label of SELF_CHECK_LABELS) {
    const group = page.locator("fieldset").filter({ hasText: label });
    await group.getByText(answer, { exact: true }).click();
  }
  await page.getByRole("button", { name: "점검 마치기" }).click();
  await expect(page.getByRole("button", { name: "다시 점검하기" })).toBeVisible();
}

/** 돌아보기 단계에서 완료 버튼을 눌러 Result까지 간다. */
export async function finishSession(page: Page): Promise<void> {
  await page.getByRole("button", { name: "이대로 완료하기" }).click();
  await expect(page).toHaveURL(/\/result\//);
  await expect(page.getByText("지금의 생각을 기록했어요.")).toBeVisible();
}
