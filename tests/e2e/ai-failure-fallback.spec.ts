import { expect, test, type Page } from "@playwright/test";
import { appAlert } from "./helpers/alerts";
import { resetActiveSession } from "./helpers/cleanup";
import {
  completeSelfAssessment,
  DEFAULT_CONTENT,
  fillStagesUntilFeedback,
  fillStagesUntilQuestioning,
  finishSession,
} from "./helpers/training-flow";

/**
 * 개발 원칙 8 — "AI 실패가 세션 실패가 되지 않는다"의 회귀 테스트.
 *
 * 이 원칙은 지금까지 코드 주석과 수동 검증으로만 지켜지고 있었다. 그동안 같은
 * 증상("힌트 버튼을 눌렀는데 아무 일도 일어나지 않는다")이 **세 번** 재발했고,
 * 매번 다른 층에서 났다: Route Handler가 빈 문자열을 반환, Guardrail이
 * action:"ask"인데 question:null을 통과시킴, Provider가 빈 질문을 성공으로 취급.
 * 공통점은 "실패했는데 화면에는 아무 표시도 없다"였다.
 *
 * 그래서 여기서는 AI 경로를 실제로 죽여놓고 **사용자에게 무엇이든 보이는지**,
 * 그리고 **그래도 완주할 수 있는지**를 확인한다.
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

/** AI 라우트를 서버 오류로 만든다. */
async function breakAiRoutes(page: Page): Promise<void> {
  await page.route("**/api/sessions/*/coach", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ errorCode: "internal_error", message: "코치를 부르지 못했어요." }),
    }),
  );
  await page.route("**/api/sessions/*/feedback", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ errorCode: "internal_error", message: "코치를 부르지 못했어요." }),
    }),
  );
}

/**
 * 대기 상태 자체의 회귀 테스트 (DESIGN.md §11 "AI Loading", §9.18).
 *
 * 제공자 타임아웃이 20초다. 그동안 화면에서 바뀌는 것이 버튼 글자 하나뿐이면,
 * 사용자 입장에서는 "눌렸는데 아무 일도 안 일어난다"와 구분되지 않는다 — 이
 * 프로젝트에서 네 번 재발한 바로 그 증상이다. 응답을 일부러 늦춰 대기 카드가
 * 실제로 뜨는지, 응답이 오면 자리를 비켜주는지 확인한다.
 */
test("AI를 기다리는 동안 무엇을 기다리는지 보인다", async ({ page }) => {
  // 단계 입력 + 실제 제공자 호출 + 일부러 넣은 2초 지연. 기본 30초로는 모자란다.
  test.setTimeout(90_000);
  await page.goto("/training/new");
  await fillStagesUntilQuestioning(page);
  await page.getByLabel("새 질문").fill("왜 이 사람만 늦을까?");
  await page.getByRole("button", { name: "질문 추가하기" }).click();

  // 실제 응답을 그대로 쓰되 2초 늦춘다 — 대기 구간을 관찰 가능한 길이로 만든다.
  await page.route("**/api/sessions/*/coach", async (route) => {
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.fulfill({ response });
  });

  await page.getByRole("button", { name: "힌트 보기" }).click();
  await expect(page.getByText("다음 질문을 정리하고 있어요.")).toBeVisible();
  // 응답이 오면 대기 카드는 사라진다 — 그 자리에 힌트가 들어선다.
  await expect(page.getByText("다음 질문을 정리하고 있어요.")).toBeHidden({
    timeout: 30_000,
  });
});

test("힌트 요청이 서버 오류로 실패하면 사용자에게 오류가 보인다", async ({ page }) => {
  await page.goto("/training/new");
  await fillStagesUntilQuestioning(page);

  // User-first gate(원칙 1)를 통과하도록 먼저 사용자가 질문을 하나 쓴다.
  await page.getByLabel("새 질문").fill("왜 이 사람만 늦을까?");
  await page.getByRole("button", { name: "질문 추가하기" }).click();

  await breakAiRoutes(page);
  await page.getByRole("button", { name: "힌트 보기" }).click();

  // 침묵하지 않는 것이 핵심이다 — 무엇이 잘못됐는지와 다시 시도할 방법이 보여야 한다.
  await expect(appAlert(page)).toHaveText(/\S/);
  // AI 실패가 "쓴 것도 날아갔다"로 읽히면 안 된다 (DESIGN.md §11 AI Error, 원칙 8).
  await expect(appAlert(page)).toContainText("작성한 내용은 그대로 있어요");
  await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();

  // 그리고 세션 자체는 멀쩡해야 한다 — 계속 쓸 수 있다.
  await page.getByLabel("새 질문").fill("다른 사람도 같은 경험을 했을까?");
  await page.getByRole("button", { name: "질문 추가하기" }).click();
  await expect(page.getByText("다른 사람도 같은 경험을 했을까?")).toBeVisible();
});

/**
 * 서버가 200으로 응답했지만 질문이 비어 있는 경우. 세 번째 재발이 정확히 이 모양이었다 —
 * 성공 응답이라 오류도 안 뜨고, 질문이 없으니 힌트 카드도 안 뜬다. AI 호출 비용만 나간다.
 */
test("서버가 빈 질문을 돌려줘도 화면이 침묵하지 않는다", async ({ page }) => {
  // 이 테스트만 실제 제공자를 부른다(응답을 받아 question만 비우기 위해). 제공자
  // 타임아웃이 20초라 기본 예산으로는 정상 동작에서도 시간을 넘긴다 — 그리고 그렇게
  // 넘긴 요청이 세션을 붙잡은 채 다음 테스트까지 깨뜨렸다(iOS Safari에서 실제로 발생).
  test.setTimeout(90_000);
  await page.goto("/training/new");
  await fillStagesUntilQuestioning(page);
  await page.getByLabel("새 질문").fill("왜 이 사람만 늦을까?");
  await page.getByRole("button", { name: "질문 추가하기" }).click();

  // 실제 응답을 받아 question만 비운다 — snapshot은 진짜 값을 그대로 쓴다.
  await page.route("**/api/sessions/*/coach", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    await route.fulfill({
      response,
      contentType: "application/json",
      body: JSON.stringify({ ...body, question: null }),
    });
  });

  await page.getByRole("button", { name: "힌트 보기" }).click();
  await expect(appAlert(page)).toHaveText(/\S/, { timeout: 30_000 });
});

test("AI가 완전히 죽어도 7단계를 완주할 수 있다 (원칙 8)", async ({ page }) => {
  await breakAiRoutes(page);
  await page.goto("/training/new");

  await fillStagesUntilFeedback(page, {
    ...DEFAULT_CONTENT,
    observation: "AI 장애 완주 검증용 관찰 문장",
  });

  // 자기 점검은 AI와 무관하게 동작해야 한다 — 이것이 규칙 기반 fallback 경로다.
  await completeSelfAssessment(page);

  // AI 피드백을 시도해도 실패하지만, 그 실패가 완주를 막지 않는다.
  await page.getByRole("button", { name: "AI 피드백 보기" }).click();
  await expect(appAlert(page)).toHaveText(/\S/);

  await finishSession(page);
});
