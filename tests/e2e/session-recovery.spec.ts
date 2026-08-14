import { expect, test } from "@playwright/test";

/**
 * DEVELOPMENT_PLAN.md §10 Phase 2 완료 조건: "새로고침 후 마지막 완료 단계와 작성 중
 * 초안이 복구됨". 세션 자체(IndexedDB 백엔드 Repository)와 초안(IndexedDB drafts)
 * 두 가지가 모두 새로고침에서 살아남아야 한다.
 */
test("새로고침해도 작성 중이던 초안이 복구된다", async ({ page }) => {
  await page.goto("/training/new");
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await page.waitForTimeout(200);

  await page.getByLabel("관찰한 장면").fill("작성 중인 초안 복구 테스트 문장");
  // debounce(500ms) 이후 IndexedDB에 저장될 시간을 준다.
  await page.waitForTimeout(800);

  await page.reload();

  await expect(page.getByLabel("관찰한 장면")).toHaveValue(
    "작성 중인 초안 복구 테스트 문장",
  );
});

test("새로고침해도 이미 완료한 단계로 되돌아가지 않는다", async ({ page }) => {
  await page.goto("/training/new");
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await page.waitForTimeout(200);

  await page.getByLabel("관찰한 장면").fill("반복되는 지각 문제");
  await page.getByRole("button", { name: "다음 질문으로" }).click();
  await expect(page.getByText("2 / 7 구분")).toBeVisible();

  const url = page.url();
  await page.reload();

  expect(page.url()).toBe(url);
  await expect(page.getByText("2 / 7 구분")).toBeVisible();
  await expect(page.getByText("반복되는 지각 문제")).toBeVisible();
});

test("나가기(보류) 후 다시 들어오면 같은 단계로 이어서 한다", async ({ page }) => {
  await page.goto("/training/new");
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await page.waitForTimeout(200);
  await page.getByLabel("관찰한 장면").fill("보류 후 재개 테스트");
  await page.getByRole("button", { name: "다음 질문으로" }).click();
  await expect(page.getByText("2 / 7 구분")).toBeVisible();
  // URL이 placeholder("/training/new")에서 실제 세션 id로 동기화될 때까지 기다린다 —
  // 그 전에 나가면 "홈으로" push와 이 동기화 replace가 경합해 홈에 도달하지 못할 수 있다.
  await expect(page).toHaveURL(/\/training\/(?!new$)[\w-]+$/);

  await page.getByRole("button", { name: "훈련 나가기" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: "이어서 하기" })).toBeVisible();

  await page.getByRole("link", { name: "이어서 하기" }).click();
  await expect(page.getByText("2 / 7 구분")).toBeVisible();
  await expect(page.getByText("보류 후 재개 테스트")).toBeVisible();
});
