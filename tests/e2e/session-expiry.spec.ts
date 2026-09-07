import { expect, test } from "@playwright/test";

/**
 * 세션이 풀렸을 때의 회귀 테스트.
 *
 * 예전에는 미인증 API 요청도 화면과 똑같이 로그인 페이지로 307을 보냈다. `fetch`는
 * 그 리다이렉트를 **따라가서 HTML을 받는다** — 호출부의 `response.json()`이 깨지고,
 * 사용자에게는 "잠시 문제가 생겼어요"만 뜬다. 재시도 버튼을 아무리 눌러도 달라지지
 * 않는데, 정작 필요한 행동(다시 로그인)은 어디에도 안내되지 않았다.
 *
 * 오래 열어두는 iOS standalone PWA에서 토큰이 만료되면 정확히 그 상태로 갇힌다 —
 * 이 앱이 상정한 사용 방식에서 언젠가 반드시 일어나는 일이다.
 *
 * 로그인이 필요 없는 검사라 자격증명 시크릿이 없는 CI에서도 돌아간다.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("미인증 API 요청은 로그인 HTML이 아니라 401 JSON을 돌려준다", async ({
  request,
}) => {
  const response = await request.get("/api/history", { maxRedirects: 0 });

  expect(response.status()).toBe(401);
  expect(response.headers()["content-type"]).toContain("application/json");

  const body = (await response.json()) as { errorCode?: string; message?: string };
  expect(body.errorCode).toBe("unauthorized");
  // 무엇을 해야 하는지가 문장에 있어야 한다(DESIGN.md §15.2).
  expect(body.message).toContain("로그인");
});

test("미인증 화면 요청은 로그인으로 보내되 원래 자리를 기억한다", async ({ page }) => {
  await page.goto("/history");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fhistory/);
});
