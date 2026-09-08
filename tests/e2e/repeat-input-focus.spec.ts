import { expect, test } from "@playwright/test";
import { resetActiveSession } from "./helpers/cleanup";
import { DEFAULT_CONTENT, settle } from "./helpers/training-flow";

/**
 * 연속으로 여러 항목을 써야 하는 화면에서, 하나를 추가한 뒤 입력창에 focus가 남는지.
 *
 * 이 앱은 한 세션에서 질문 3개와 대안 프레임 2개를 요구한다. 추가 버튼을 누르면
 * focus가 버튼에 남아, iPhone에서는 **매번 입력창을 다시 눌러야 키보드가 열린다** —
 * 세션당 다섯 번의 불필요한 탭이다.
 *
 * `focus()`를 저장이 끝난 뒤가 아니라 **await 앞에서** 부르는 것이 중요하다. iOS는
 * 사용자 제스처가 살아 있는 동안에만 키보드를 열어주기 때문이다. 그 순서가 뒤집히면
 * focus만 가고 키보드는 닫힌 채로 남는다.
 */
test.skip(
  !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
  "E2E_TEST_EMAIL/PASSWORD 미설정 — 로그인 필요한 E2E는 건너뜀 (.env.example 참고)",
);

test.beforeEach(async ({ request }) => {
  await resetActiveSession(request);
});

test("항목을 추가하면 입력창에 focus가 남는다", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/training/new");
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await settle(page);
  await page.getByLabel("관찰한 장면").fill(DEFAULT_CONTENT.observation);
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  // 구분 단계 — 항목 추가
  await expect(page.getByText("2 / 7 구분")).toBeVisible();
  await settle(page);
  const itemField = page.getByLabel("추가할 항목");
  await itemField.fill(DEFAULT_CONTENT.observationItem);
  await page.getByRole("button", { name: "항목 추가하기" }).click();
  await expect(itemField).toBeFocused();
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  // 질문 단계 — 3개를 연달아 써야 하는 곳이라 여기가 가장 아프다
  await expect(page.getByText("3 / 7 질문")).toBeVisible();
  await settle(page);
  const questionField = page.getByLabel("새 질문");
  for (const q of DEFAULT_CONTENT.questions) {
    await questionField.fill(q);
    await page.getByRole("button", { name: "질문 추가하기" }).click();
    await expect(questionField).toBeFocused();
  }
});
