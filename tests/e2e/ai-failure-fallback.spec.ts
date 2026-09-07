import { expect, test, type Page } from "@playwright/test";
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

test("힌트 요청이 서버 오류로 실패하면 사용자에게 오류가 보인다", async ({ page }) => {
  await page.goto("/training/new");
  await fillStagesUntilQuestioning(page);

  // User-first gate(원칙 1)를 통과하도록 먼저 사용자가 질문을 하나 쓴다.
  await page.getByLabel("새 질문").fill("왜 이 사람만 늦을까?");
  await page.getByRole("button", { name: "질문 추가하기" }).click();

  await breakAiRoutes(page);
  await page.getByRole("button", { name: "힌트 보기" }).click();

  // 침묵하지 않는 것이 핵심이다 — 무엇이 잘못됐는지와 다시 시도할 방법이 보여야 한다.
  await expect(page.getByRole("alert")).toBeVisible();
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
  await expect(page.getByRole("alert")).toBeVisible();
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
  await expect(page.getByRole("alert")).toBeVisible();

  await finishSession(page);
});
