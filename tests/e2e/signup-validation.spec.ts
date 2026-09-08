import { expect, test } from "@playwright/test";

/**
 * 인증 폼이 **보내기 전에** 막아주는지 확인한다.
 *
 * 가입 화면은 신규 사용자가 가장 먼저 만나는 입력이고, 여기서 막히면 앱을 못 쓴다.
 * 그런데 끝까지 확인하려면 실제 계정과 메일 인증이 필요해서 자동 검증이 하나도
 * 없었다. 계정을 만들지 않고도 잠글 수 있는 부분 — 형식 검사와 출구 — 만 본다.
 * 이 경로는 네트워크에 닿지 않는다.
 *
 * 로그인이 필요 없는 검사라 자격증명 시크릿이 없는 CI에서도 돌아간다.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("가입", () => {
  test("이메일 형식이 아니면 보내기 전에 알려준다", async ({ page }) => {
    await page.goto("/auth/signup");

    await page.getByLabel("이메일").fill("골뱅이가없다");
    await page.getByLabel("비밀번호", { exact: true }).fill("password123");
    await page.getByRole("button", { name: "회원가입" }).click();

    await expect(page.getByText("올바른 이메일 형식이 아니에요.")).toBeVisible();
    // 막혔으면 화면을 떠나지 않는다.
    await expect(page).toHaveURL(/\/auth\/signup/);
  });

  test("비밀번호가 짧으면 규칙을 문장으로 알려준다", async ({ page }) => {
    await page.goto("/auth/signup");

    // 규칙은 누르기 전에도 보여야 한다(DESIGN.md §10.9.2 "최소 길이 등 규칙을
    // Helper Text로 상시 노출").
    await expect(page.getByText("8자 이상으로 만들어주세요.")).toBeVisible();

    await page.getByLabel("이메일").fill("someone@example.com");
    await page.getByLabel("비밀번호", { exact: true }).fill("short");
    await page.getByRole("button", { name: "회원가입" }).click();

    await expect(page.getByText("비밀번호는 8자 이상이어야 해요.")).toBeVisible();
  });

  test("이미 계정이 있는 사람은 로그인으로 갈 수 있다", async ({ page }) => {
    // 없으면 주소를 직접 고쳐야 한다.
    await page.goto("/auth/signup");
    await page.getByRole("link", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe("비밀번호 재설정 완료", () => {
  test("두 번 입력한 비밀번호가 다르면 알려준다", async ({ page }) => {
    /*
      이 화면은 메일 링크로만 오지만, 폼 자체는 세션 없이도 그려진다 — 검사도 여기서
      먼저 돈다. 두 값이 다른 채로 보내면 사용자는 자기가 뭘 잘못했는지 모른 채
      "잠시 후 다시 시도해주세요"만 보게 된다.
    */
    await page.goto("/auth/reset-password/confirm");

    await page.getByLabel("새 비밀번호", { exact: true }).fill("password123");
    await page.getByLabel("새 비밀번호 확인").fill("password124");
    await page.getByRole("button", { name: "비밀번호 변경하기" }).click();

    await expect(page.getByText("비밀번호가 서로 달라요.")).toBeVisible();
  });
});
