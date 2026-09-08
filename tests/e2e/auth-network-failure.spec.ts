import { expect, test } from "@playwright/test";

/**
 * 인증 화면에서 "서버에 닿지 못했다"와 "자격 증명이 틀렸다"를 구분하는지 확인한다.
 *
 * 둘을 같은 문구로 뭉뚱그리면 문구가 사용자를 잘못된 곳으로 보낸다. 지하철에서
 * 연결이 끊긴 사람에게 "이메일 또는 비밀번호를 다시 확인해주세요"라고 말하면, 맞는
 * 비밀번호를 몇 번이고 다시 입력하다가 자기 계정을 의심하게 된다. 앱의 다른 저장
 * 경로는 이미 이 구분을 하고 있었는데(`lib/network-status.ts`) 인증 화면만 빠져 있었다.
 *
 * 비밀번호 재설정은 반대 방향의 거짓말이었다. 계정 존재를 감추려고 결과를 분기하지
 * 않다 보니, 요청이 서버에 닿지도 못한 경우에도 "보냈어요"라고 말했다 — 사용자는
 * 오지 않을 메일을 기다린다. 계정 열거를 막는 것은 **서버가 대답한** 경우의 문구를
 * 하나로 두는 것이지, 보내지 못한 것을 보냈다고 하는 것이 아니다.
 *
 * 로그인이 필요 없는 검사라 자격증명 시크릿이 없는 CI에서도 돌아간다.
 */
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * Service Worker는 끄고 돈다. 여기서는 `page.route`로 인증 요청을 죽여 전송 실패를
 * 만드는데, Service Worker가 먼저 가로채면 WebKit에서 요청이 그대로 서버까지 간다
 * (`ai-failure-fallback.spec.ts`에서 같은 함정에 빠진 적이 있다).
 */
test.use({ serviceWorkers: "block" });

const CREDENTIAL_MESSAGE = "이메일 또는 비밀번호를 다시 확인해주세요.";
const NETWORK_MESSAGE = "지금 서버에 닿지 못했어요.";

test("연결이 끊긴 로그인 실패를 비밀번호 탓으로 돌리지 않는다", async ({ page }) => {
  // 인증 요청만 죽인다. 화면 자체는 정상적으로 뜨는 상태여야 "로그인만 실패한다"는
  // 상황이 재현된다.
  await page.route("**/auth/v1/token**", (route) => route.abort("failed"));

  await page.goto("/auth/login");
  await page.getByLabel("이메일").fill("someone@example.com");
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill("wrong-password-does-not-matter");
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page.getByText(NETWORK_MESSAGE, { exact: false })).toBeVisible();
  await expect(page.getByText(CREDENTIAL_MESSAGE)).toHaveCount(0);

  // 관측한 실패가 네트워크 상태에도 반영돼야 한다 — 인증 화면만 이 관측에서 빠져
  // 있어서, 로그인이 안 되는 진짜 이유가 화면 어디에도 없었다.
  await expect(page.getByText("오프라인이에요.", { exact: false })).toBeVisible();
});

test("보내지 못한 재설정 메일을 보냈다고 하지 않는다", async ({ page }) => {
  await page.route("**/auth/v1/recover**", (route) => route.abort("failed"));

  await page.goto("/auth/reset-password");
  await page.getByLabel("이메일").fill("someone@example.com");
  await page.getByRole("button", { name: "재설정 링크 보내기" }).click();

  await expect(page.getByText(NETWORK_MESSAGE, { exact: false })).toBeVisible();
  await expect(page.getByText("재설정 링크를 보냈어요", { exact: false })).toHaveCount(0);
});

test("서버가 대답한 로그인 실패는 예전 문구 그대로다", async ({ page }) => {
  // 계정 열거를 막는 문구는 그대로여야 한다 — 위 구분이 이 보호를 무너뜨리지
  // 않았는지 함께 확인한다. 서버가 대답하기만 하면(여기서는 400) 문구는 하나다.
  await page.route("**/auth/v1/token**", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error_code: "invalid_credentials", msg: "Invalid" }),
    }),
  );

  await page.goto("/auth/login");
  await page.getByLabel("이메일").fill("someone@example.com");
  await page.getByLabel("비밀번호", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page.getByText(CREDENTIAL_MESSAGE)).toBeVisible();
  await expect(page.getByText("오프라인이에요.", { exact: false })).toHaveCount(0);
});
