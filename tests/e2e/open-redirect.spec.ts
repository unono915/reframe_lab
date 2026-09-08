import { expect, test } from "@playwright/test";

/**
 * 열린 리다이렉트(CWE-601) 회귀 테스트.
 *
 * 로그인 뒤 돌아갈 자리는 `?next=`로 오고, URL은 누구나 만들 수 있다. 이 값을
 * 검증 없이 `router.push`에 넘기고 있었다 — `?next=https://가짜다시봄` 링크를 받은
 * 사람은 **진짜 도메인에서 진짜 로그인 폼에 진짜 비밀번호를 넣은 직후** 남의
 * 사이트로 넘어간다. 거기서 같은 화면을 흉내 내며 "세션이 만료됐어요"라고 하면
 * 비밀번호를 한 번 더 받아낼 수 있다. 도메인을 확인하는 습관이 오히려 피해자를
 * 안심시키는 구조라 특히 나쁘다.
 *
 * 단위 테스트(`tests/unit/lib/auth/next-path.test.ts`)가 판정 함수를 고정하고,
 * 여기서는 **실제 로그인 성공 경로에 그 판정이 실제로 걸려 있는지**를 확인한다.
 * 함수만 맞고 호출부에서 안 쓰면 아무 소용이 없기 때문이다.
 *
 * 이 파일은 storageState를 비우고 폼으로 직접 로그인하는 유일한 테스트이기도 하다 —
 * 덤으로 로그인 화면 자체의 실동작 회귀 테스트가 된다.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.skip(
  !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
  "E2E_TEST_EMAIL/PASSWORD 미설정 — 로그인 필요한 E2E는 건너뜀 (.env.example 참고)",
);

async function login(page: import("@playwright/test").Page, nextParam: string) {
  await page.goto(`/auth/login?next=${encodeURIComponent(nextParam)}`);
  await page.getByLabel("이메일").fill(process.env.E2E_TEST_EMAIL!);
  await page.getByLabel("비밀번호", { exact: true }).fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole("button", { name: "로그인" }).click();
}

test("로그인 뒤 다른 사이트로 보내지 않는다", async ({ page }) => {
  await login(page, "https://example.com/phishing");

  // 홈으로 간다. 어디로 가든 이 앱 안이어야 한다는 것이 요점이다.
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/"));
  await expect(page).toHaveURL(/\/$/);
  expect(page.url()).not.toContain("example.com");
});

test("이 앱 안의 자리로는 예전처럼 되돌려준다", async ({ page }) => {
  // 보호가 기능을 죽이지 않았는지 함께 본다 — 세션 만료로 튕긴 사람은 원래 보던
  // 화면으로 돌아와야 한다(`lib/fetch-json.ts`가 그 링크를 만든다).
  await login(page, "/history");

  await expect(page).toHaveURL(/\/history$/);
});
