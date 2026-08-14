import { expect, type Page, test } from "@playwright/test";

/**
 * DEVELOPMENT_PLAN.md §10 Phase 2 완료 조건: "7단계를 처음부터 끝까지 진행해 완료
 * 상태에 도달 가능". Home → 7단계 → Result까지 실제 폼 입력으로 완주한다.
 *
 * 각 단계 진입 직후 짧게 안정화 대기를 둔다 — 실제 사용자는 화면을 보고 나서 입력을
 * 시작하지만 Playwright는 즉시 입력하므로, mount 직후 진행되는 초안 복구 useEffect와
 * 첫 keystroke가 겹치면 드물게 입력이 누락되는 경우가 있었다(로컬에서 재현).
 */
async function settle(page: Page) {
  await page.waitForTimeout(200);
}

test("완주: Home에서 시작해 7단계를 모두 거쳐 Result에 도달한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("오늘 다시 볼 장면")).toBeVisible();
  await page.getByRole("link", { name: /오늘의 훈련 시작|이어서 하기/ }).click();

  // 1. 관찰
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await settle(page);
  await page
    .getByLabel("관찰한 장면")
    .fill("회의 때마다 한 사람이 항상 10분씩 늦게 들어온다");
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  // 2. 구분
  await expect(page.getByText("2 / 7 구분")).toBeVisible();
  await settle(page);
  await page.getByLabel("추가할 항목").fill("지난 3번의 회의에서 10분 이상 늦었다");
  await page.getByRole("button", { name: "항목 추가하기" }).click();
  await expect(page.getByText("확인됨")).toBeVisible();
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  // 3. 질문 — 사용자 작성 질문 3개 + 핵심 질문 1개 선택 (requirements.ts questioning 조건)
  await expect(page.getByText("3 / 7 질문")).toBeVisible();
  await settle(page);
  const questionField = page.getByLabel("새 질문");
  for (const q of [
    "왜 이 사람만 늦을까?",
    "다른 사람도 같은 경험을 했을까?",
    "회의 시간을 바꾸면 나아질까?",
  ]) {
    await questionField.fill(q);
    await page.getByRole("button", { name: "질문 추가하기" }).click();
  }
  await page.getByRole("button", { name: "핵심 질문으로 고르기" }).first().click();
  await page.getByLabel("이 질문을 고른 이유").fill("가장 반복적으로 발생하기 때문");
  await page.getByRole("button", { name: "핵심 질문으로 선택" }).click();
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  // 4. 탐색 — 4개 필수 프롬프트
  await expect(page.getByText("4 / 7 탐색")).toBeVisible();
  await settle(page);
  await page
    .getByLabel(/가장 직접적인 영향을 받는 사람/)
    .fill("늦게 오는 사람 본인과 나머지 참석자들");
  await page.getByLabel(/어떤 상황·맥락/).fill("매주 월요일 정기 회의");
  await page
    .getByLabel(/무엇이 어렵거나 달라졌나요/)
    .fill("회의 시작이 늦어져 다음 일정이 밀린다");
  await page.getByLabel(/아직 확실히 모르는 부분/).fill("모르겠다");
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  // 5. 재정의 — 사용자 작성 reframe 2개
  await expect(page.getByText("5 / 7 재정의")).toBeVisible();
  await settle(page);
  const reframeField = page.getByLabel("대안 문제 프레임");
  await reframeField.fill("회의 시작 시각과 이동 동선이 맞지 않는 것이 문제일 수 있다");
  await page.getByRole("button", { name: "프레임 추가하기" }).click();
  await reframeField.fill("지각 자체보다 회의 시작을 알리는 방식이 문제일 수 있다");
  await page.getByRole("button", { name: "프레임 추가하기" }).click();
  await expect(page.getByText("다른 관점 2")).toBeVisible();
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  // 6. 정의
  await expect(page.getByText("6 / 7 정의")).toBeVisible();
  await settle(page);
  await page
    .getByLabel("현재의 문제 정의")
    .fill("회의 시작 시각과 참석자 이동 동선이 맞지 않아 반복 지각이 발생하고 있다");
  await page.getByRole("button", { name: "이대로 기록하기" }).click();

  // 7. 돌아보기 — AI 피드백 확인 후 완료
  await expect(page.getByText("7 / 7 돌아보기")).toBeVisible();
  await settle(page);
  await page.getByRole("button", { name: "AI 피드백 보기" }).click();
  await expect(page.getByText("이미 드러난 점")).toBeVisible();
  await page.getByRole("button", { name: "이대로 완료하기" }).click();

  await expect(page).toHaveURL(/\/result\//);
  await expect(page.getByText("지금의 생각을 기록했어요.")).toBeVisible();
  // AI 피드백이 정의 문장을 그대로 인용하므로 같은 텍스트가 두 번 나타난다 — 정의 자체는
  // "현재의 문제 정의" 라벨 옆의 정확히 일치하는 문단으로 좁혀서 확인한다.
  await expect(
    page.getByText(
      "회의 시작 시각과 참석자 이동 동선이 맞지 않아 반복 지각이 발생하고 있다",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
});

test("완주(자기 점검 경로): AI 피드백 없이 체크리스트만으로도 완료할 수 있다", async ({
  page,
}) => {
  await page.goto("/training/new");
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await settle(page);

  await page.getByLabel("관찰한 장면").fill("팀 채팅에 아무도 답을 안 한다");
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("2 / 7 구분")).toBeVisible();
  await settle(page);
  await page.getByLabel("추가할 항목").fill("어제 올린 질문에 아직 답이 없다");
  await page.getByRole("button", { name: "항목 추가하기" }).click();
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("3 / 7 질문")).toBeVisible();
  await settle(page);
  const questionField = page.getByLabel("새 질문");
  for (const q of ["다들 못 본 걸까?", "질문이 불명확했을까?", "다른 채널이 나을까?"]) {
    await questionField.fill(q);
    await page.getByRole("button", { name: "질문 추가하기" }).click();
  }
  await page.getByRole("button", { name: "핵심 질문으로 고르기" }).first().click();
  await page.getByLabel("이 질문을 고른 이유").fill("가장 빨리 확인 가능함");
  await page.getByRole("button", { name: "핵심 질문으로 선택" }).click();
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("4 / 7 탐색")).toBeVisible();
  await settle(page);
  await page.getByLabel(/가장 직접적인 영향을 받는 사람/).fill("질문을 올린 나");
  await page.getByLabel(/어떤 상황·맥락/).fill("바쁜 주간의 팀 채팅");
  await page.getByLabel(/무엇이 어렵거나 달라졌나요/).fill("결정이 미뤄지고 있다");
  await page.getByLabel(/아직 확실히 모르는 부분/).fill("모르겠다");
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("5 / 7 재정의")).toBeVisible();
  await settle(page);
  const reframeField = page.getByLabel("대안 문제 프레임");
  await reframeField.fill("질문이 너무 길어서 다들 미룬 것일 수 있다");
  await page.getByRole("button", { name: "프레임 추가하기" }).click();
  await reframeField.fill("채팅보다 회의에서 다룰 주제였을 수 있다");
  await page.getByRole("button", { name: "프레임 추가하기" }).click();
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("6 / 7 정의")).toBeVisible();
  await settle(page);
  await page
    .getByLabel("현재의 문제 정의")
    .fill("질문 형식과 채널이 맞지 않아 팀 채팅 응답이 늦어지고 있다");
  await page.getByRole("button", { name: "이대로 기록하기" }).click();

  await expect(page.getByText("7 / 7 돌아보기")).toBeVisible();
  await settle(page);

  // AI 피드백을 요청하지 않고 체크리스트만으로 완료 (PRD §7.10 Fallback path)
  for (const label of [
    "실제 장면이나 확인된 사실에서 출발했나요?",
    "누가 어떤 상황에서 겪는 문제인지 드러나나요?",
    "원하는 것과 방해 요소, 결과가 구분되나요?",
    "확인되지 않은 원인을 단정하지 않았나요?",
    "지나치게 넓거나 특정 해결책으로 고정되지 않았나요?",
    "무엇을 더 확인해야 하는지 알 수 있나요?",
  ]) {
    await page.getByLabel(label).check();
  }
  await page.getByRole("button", { name: "체크리스트 완료로 표시" }).click();
  await page.getByRole("button", { name: "이대로 완료하기" }).click();

  await expect(page).toHaveURL(/\/result\//);
  await expect(page.getByText("지금의 생각을 기록했어요.")).toBeVisible();
});
