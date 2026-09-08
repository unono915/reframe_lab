import { expect, test } from "@playwright/test";

/**
 * 온보딩 진입 경로의 회귀 테스트.
 *
 * 이 화면(S-01, DESIGN.md §10.1)은 만들어져 있었지만 **어디서도 연결되지 않아
 * 사용자가 도달할 수 없었다** — URL을 직접 치는 사람만 볼 수 있었다. 미인증 접근은
 * 전부 로그인 폼으로 갔다.
 *
 * 이 화면이 하는 일은 기대치를 맞추는 것이다. 사용자는 답을 받으러 왔다가 질문을
 * 받게 되므로, 방향이 뒤집혀 있다는 것을 먼저 알아야 첫 단계에서 당황하지 않는다.
 * 그래서 "도달 가능한가"가 곧 기능이다.
 *
 * 로그인이 필요 없는 검사라 자격증명 시크릿이 없는 CI에서도 돌아간다.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("처음 오는 사람은 로그인 폼이 아니라 소개 화면을 본다", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading")).toContainText("장면을 한 번 더 봅니다");
});

test("한 번 보고 나면 다시 붙잡지 않는다", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByRole("link", { name: "건너뛰기" }).click();
  await expect(page).toHaveURL(/\/auth\/login/);

  // 다시 루트로 와도 소개 화면으로 돌려보내지 않는다.
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("깊은 링크로 온 사람은 소개 화면을 거치지 않는다", async ({ page }) => {
  // 갈 곳이 분명한 사람을 세 화면 붙잡아 두면 목적지만 멀어진다.
  // 로그인 뒤 원래 자리로 돌아갈 수 있도록 `next`도 그대로 유지된다.
  await page.goto("/history");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fhistory/);
});
