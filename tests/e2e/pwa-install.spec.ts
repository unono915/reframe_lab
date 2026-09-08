import { expect, test } from "@playwright/test";

/**
 * 홈 화면 설치형으로 열렸을 때 앱처럼 보이기 위한 선언들의 회귀 테스트.
 *
 * 이 앱의 1차 타깃은 "iPhone 홈 화면 설치형"이다. 그런데 그 경험을 결정하는 것은
 * 코드가 아니라 `<head>`의 선언 몇 줄이고, **빠져도 개발 중에는 아무 표시가 나지
 * 않는다** — 브라우저 탭에서는 똑같이 잘 보인다. 실기에서 아이콘을 눌러봐야 안다.
 *
 * 실제로 하나가 빠져 있었다. `appleWebApp.capable: true`를 선언했는데도 Next 16은
 * 그것을 modern 태그(`mobile-web-app-capable`) 하나로만 내보내서, 레거시 태그를
 * 읽는 iOS 16.4 미만에서는 홈 화면에서 열어도 Safari UI가 남는 상태였다.
 *
 * 로그인이 필요 없는 검사라 자격증명 시크릿이 없는 CI에서도 돌아간다.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("홈 화면에서 열면 앱처럼 뜨도록 선언돼 있다", async ({ page }) => {
  await page.goto("/onboarding");

  // iOS 16.4+ 와 Android/Chrome이 읽는 쪽.
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute(
    "content",
    "yes",
  );
  // iOS 16.4 미만이 읽는 쪽. 둘 다 있어야 버전에 상관없이 standalone으로 뜬다.
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    "content",
    "yes",
  );
  // safe-area(노치·홈 인디케이터)를 실제로 쓰려면 콘텐츠가 가장자리까지 가야 한다.
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /viewport-fit=cover/,
  );
});

test("매니페스트와 아이콘이 실제로 받아진다", async ({ page, request }) => {
  await page.goto("/onboarding");

  const manifestHref = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href")
    .then((href) => href ?? "");
  expect(manifestHref).not.toBe("");

  const manifestRes = await request.get(manifestHref);
  expect(manifestRes.ok()).toBe(true);
  const manifest = (await manifestRes.json()) as {
    display?: string;
    icons?: { src: string }[];
  };
  expect(manifest.display).toBe("standalone");

  // 아이콘이 404여도 화면에서는 티가 안 난다 — 홈 화면에 회색 사각형이 남을 뿐이다.
  const iconSources = [
    ...(manifest.icons ?? []).map((icon) => icon.src),
    await page.locator('link[rel="apple-touch-icon"]').first().getAttribute("href"),
  ].filter((src): src is string => Boolean(src));
  expect(iconSources.length).toBeGreaterThan(0);

  for (const src of iconSources) {
    const res = await request.get(src);
    expect(res.status(), `${src}가 받아지지 않는다`).toBe(200);
  }
});
