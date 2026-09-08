import { expect, test } from "@playwright/test";
import { resetActiveSession } from "./helpers/cleanup";
import { settle } from "./helpers/training-flow";

/**
 * DESIGN.md §11 "Offline Draft" 배너의 회귀 테스트.
 *
 * 이 배너가 하는 일은 하나다: 저장이 실패하기 **전에** 왜 실패할지 알려주는 것.
 * 없을 때는 오프라인에서 "다음 질문으로"를 누른 뒤에야 오류 문구를 보게 되고,
 * 사용자는 그것을 앱 고장으로 읽는다.
 *
 * 자동 새로고침·자동 재전송은 하지 않는다(원칙 7 — 작성 중인 세션이 연결 복귀만으로
 * 새로고침되면 안 된다). 그래서 여기서 확인하는 것도 "상태를 알린다"까지다.
 */
/**
 * Service Worker를 끄고 돈다. 아래 마지막 테스트는 `page.route`로 요청을 죽여
 * "브라우저는 온라인이라는데 요청은 실패하는" 상황을 만드는데, PWA의 Service
 * Worker가 요청을 먼저 가로채면 그 가로채기가 닿지 않는다 — WebKit에서는 요청이
 * 그대로 서버까지 가서 저장이 **성공해버렸다**(`ai-failure-fallback.spec.ts`와 같은 함정).
 */
test.use({ serviceWorkers: "block" });

test.skip(
  !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
  "E2E_TEST_EMAIL/PASSWORD 미설정 — 로그인 필요한 E2E는 건너뜀 (.env.example 참고)",
);

test.beforeEach(async ({ request }) => {
  await resetActiveSession(request);
});

// 이 파일의 테스트는 훈련 세션을 만들고 실제 저장 왕복까지 한다. iOS Safari에서
// 기본 30초를 넘겨 깨진 적이 있다 — 느린 이유가 있으므로 예산을 명시한다.
test.slow();

test("연결이 끊기면 알리고, 돌아오면 사라진다", async ({ page, context }) => {
  await page.goto("/training/new");
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await settle(page);

  const banner = page.getByText("오프라인이에요.", { exact: false });
  await expect(banner).toBeHidden();

  await context.setOffline(true);
  // 훈련 중에는 "쓴 것이 어디 있는지"를 함께 알린다.
  await expect(banner).toContainText("작성한 내용은 이 기기에 남겨둘게요");

  await context.setOffline(false);
  await expect(banner).toBeHidden();
});

test("오프라인이어도 작성 중인 내용은 화면에 그대로 남는다", async ({
  page,
  context,
}) => {
  await page.goto("/training/new");
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await settle(page);

  const text = "연결이 끊긴 동안 쓴 관찰 문장";
  await page.getByLabel("관찰한 장면").fill(text);
  await context.setOffline(true);

  // 배너가 떠도 입력은 건드리지 않는다 — 배너는 알리기만 하고 아무것도 되돌리지 않는다.
  await expect(page.getByText("오프라인이에요.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("관찰한 장면")).toHaveValue(text);

  // 배너는 화면 하단에 고정된다. 훈련 화면의 주 버튼도 하단에 있으므로, 배너가 그
  // 버튼을 덮어버리면 **오프라인일 때만 앱이 잠기는** 셈이 된다. `trial: true`는
  // 실제로 누르지 않고 "지금 누를 수 있는 상태인가"만 확인한다 — 다른 요소에
  // 가려져 있으면 실패한다(toBeVisible로는 잡히지 않는 종류의 결함이다).
  await page.getByRole("button", { name: "다음 질문으로" }).click({ trial: true });

  await context.setOffline(false);
});

test("브라우저가 온라인이라고 우겨도, 요청이 실패하면 알린다", async ({ page }) => {
  // 실제로 겪은 상황: 네트워크가 끊겨 모든 요청이 net::ERR_FAILED로 죽는데도
  // `navigator.onLine === true`였다. 캡티브 포털(로그인 안 한 공용 와이파이)도 같은
  // 모양이다 — 인터페이스는 붙어 있고 요청만 가로채인다. 브라우저의 신고만 믿으면
  // 배너가 정작 필요한 순간에 안 뜬다.
  //
  // 그래서 `lib/network-status.ts`는 **관측한 요청 결과**를 함께 본다. 여기서는
  // `navigator.onLine`을 건드리지 않고 요청만 죽여서 그 규칙을 확인한다.
  await page.goto("/training/new");
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await settle(page);

  const banner = page.getByText("오프라인이에요.", { exact: false });
  await expect(banner).toBeHidden();

  // 저장 경로만 끊는다. `**/api/**` 전체를 끊으면 세션 조회까지 죽어서 화면이
  // 아예 안 그려진다 — 여기서 보려는 것은 "저장이 실패했을 때"이지 "앱을 못 여는
  // 상황"이 아니다(그건 앞의 두 테스트가 본다).
  await page.route("**/api/sessions/*/mutate", (route) => route.abort("failed"));
  await page.getByLabel("관찰한 장면").fill("연결이 죽은 동안 쓴 문장");
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(banner).toBeVisible();
  // 브라우저는 여전히 온라인이라고 말한다 — 그 값만 봤다면 배너가 뜨지 않았을 것이다.
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);
  // 쓴 내용은 그대로다.
  await expect(page.getByLabel("관찰한 장면")).toHaveValue("연결이 죽은 동안 쓴 문장");

  // 다시 닿기 시작하면 배너는 사라진다 — 새로고침 없이.
  await page.unroute("**/api/sessions/*/mutate");
  await page.getByRole("button", { name: "다음 질문으로" }).click();
  await expect(banner).toBeHidden();
});
