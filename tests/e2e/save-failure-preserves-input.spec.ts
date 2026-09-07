import { expect, test, type Page } from "@playwright/test";
import { appAlert } from "./helpers/alerts";
import { resetActiveSession } from "./helpers/cleanup";
import { DEFAULT_CONTENT, settle } from "./helpers/training-flow";

/**
 * 개발 원칙 7 — "입력 유실 금지"의 회귀 테스트. 이 프로젝트에서 가장 중요한
 * 신뢰성 요구이고, 어떤 최적화도 이보다 우선하지 않는다(CLAUDE.md §11).
 *
 * 여기서 잠그는 것은 **저장이 실패했을 때**의 동작이다. 지금까지 이 경로는
 * 세 겹으로 무너져 있었다:
 *
 *  1. `callMutate`가 non-2xx 응답에서 옛 스냅샷을 그대로 돌려줬다 — 호출자는
 *     "아무것도 안 바뀐 성공"과 구분할 수 없어서 그대로 `advance()`로 넘어갔다.
 *  2. `advance()`는 서버에 요청을 **보내기 전에** IndexedDB 초안을 지웠다.
 *  3. 그래서 서버 저장이 실패하면 입력이 서버에도 기기에도 남지 않는데,
 *     화면에는 "작성한 내용은 그대로 있어요"가 떴다.
 *
 * 이 조합은 네트워크가 끊긴 경우가 아니라 **서버가 500을 주는 경우**에만 나는데,
 * 이 프로젝트는 실제로 Supabase JWT 시각 오차로 500을 겪은 적이 있다.
 *
 * 새로고침 뒤 초안이 살아있는지까지 확인하는 것이 이 테스트의 핵심이다 —
 * 화면에 텍스트가 남아있는 것만으로는 2번이 고쳐졌다는 증거가 되지 않는다
 * (React state에는 남아있으니까).
 */
/**
 * Service Worker를 끄고 돈다. 이 파일의 테스트는 `page.route`로 API 응답을
 * 바꿔치기해서 실패를 만들어내는데, PWA의 Service Worker가 요청을 먼저 가로채면
 * Playwright의 라우트 가로채기가 닿지 않는다. Chromium에서는 통과했지만 WebKit
 * (iOS Safari)에서는 요청이 그대로 서버까지 가서 **실패가 일어나지 않았다** —
 * 그런데 예전 단언(`toBeVisible()`)은 Next.js의 빈 route announcer에 걸려 통과했기
 * 때문에 아무도 눈치채지 못했다. 여기서 검증하는 것은 오프라인 캐시가 아니라
 * 실패 처리라, Service Worker를 빼는 것이 오히려 검증 대상을 좁혀준다.
 */
test.use({ serviceWorkers: "block" });

test.skip(
  !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
  "E2E_TEST_EMAIL/PASSWORD 미설정 — 로그인 필요한 E2E는 건너뜀 (.env.example 참고)",
);

test.beforeEach(async ({ request }) => {
  await resetActiveSession(request);
});

/** 저장(mutate) 라우트만 서버 오류로 만든다. 조회·전환 라우트는 건드리지 않는다. */
async function breakSaveRoute(page: Page): Promise<void> {
  await page.route("**/api/sessions/*/mutate", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        errorCode: "internal_error",
        message: "저장하지 못했어요. 잠시 후 다시 시도해주세요.",
      }),
    }),
  );
}

test("저장이 실패하면 사용자에게 알리고, 새로고침해도 쓴 내용이 남아있다", async ({
  page,
}) => {
  await page.goto("/training/new");
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await settle(page);

  await page.getByLabel("관찰한 장면").fill(DEFAULT_CONTENT.observation);
  // 초안이 IndexedDB에 실제로 쓰이도록 debounce(500ms)를 넘긴다.
  await page.waitForTimeout(900);

  await breakSaveRoute(page);
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  // ① 실패를 사용자에게 알린다 — 조용히 끝나지 않는다.
  await expect(appAlert(page)).toContainText("저장하지 못했어요");
  // ② 단계가 넘어가지 않는다.
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  // ③ 쓴 내용이 화면에 그대로 있다.
  await expect(page.getByLabel("관찰한 장면")).toHaveValue(DEFAULT_CONTENT.observation);

  // ④ 진짜 확인하고 싶은 것: 초안이 지워지지 않았는가. 라우트 가로채기를 풀고
  //    새로고침하면 React state는 사라지므로, 남아있다면 IndexedDB에서 온 것이다.
  await page.unroute("**/api/sessions/*/mutate");
  await page.reload();
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await expect(page.getByLabel("관찰한 장면")).toHaveValue(DEFAULT_CONTENT.observation);
});

test("항목 추가가 실패하면 비워진 입력창이 되돌아온다", async ({ page }) => {
  await page.goto("/training/new");
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await settle(page);
  await page.getByLabel("관찰한 장면").fill(DEFAULT_CONTENT.observation);
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("2 / 7 구분")).toBeVisible();
  await settle(page);

  // 보조 동작(주 버튼이 아닌 "항목 추가하기")은 StageShell의 오류 처리를 타지 않는다.
  // 예전에는 입력창을 먼저 비운 뒤 저장했기 때문에, 실패하면 쓴 문장이 사라졌다.
  await breakSaveRoute(page);
  await page.getByLabel("추가할 항목").fill(DEFAULT_CONTENT.observationItem);
  await page.getByRole("button", { name: "항목 추가하기" }).click();

  await expect(appAlert(page)).toContainText("저장하지 못했어요");
  await expect(page.getByLabel("추가할 항목")).toHaveValue(
    DEFAULT_CONTENT.observationItem,
  );
});
