import { expect, test } from "@playwright/test";
import { resetActiveSession } from "./helpers/cleanup";
import { DEFAULT_CONTENT, settle } from "./helpers/training-flow";

/**
 * 단계마다 "코치에게 질문 하나 받기"가 열리는 조건의 회귀 테스트.
 *
 * 이 앱의 핵심 동작인데 **일곱 단계 중 질문 단계 하나에만 버튼이 있었다.** 프롬프트도
 * 규칙 기반 대체 질문도 Guardrail도 일곱 단계 전부를 상정해 만들어져 있었고
 * (DEVELOPMENT_PLAN §8.2), 라우트도 어느 단계든 받는다. 화면에서 부르는 곳만 없었다.
 *
 * 여기서 잠그는 것은 두 가지다.
 *
 * 1. **먼저 쓰기 전에는 열리지 않는다**(원칙 1). 빈 화면에 대고 AI를 부르지 않는다.
 * 2. **쓰고 나면 열린다.** 관찰·탐색처럼 "다음"을 눌러야 저장되는 단계에서도 열려야
 *    한다 — 서버 스냅샷만 보고 판단하면 그 단계들은 영영 버튼이 없다.
 */
test.skip(
  !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
  "E2E_TEST_EMAIL/PASSWORD 미설정 — 로그인 필요한 E2E는 건너뜀 (.env.example 참고)",
);

test.beforeEach(async ({ request }) => {
  await resetActiveSession(request);
});

const ASK = "막히면 질문 하나 받기";

test("관찰 단계: 쓰기 전에는 없고, 쓰면 열린다", async ({ page }) => {
  await page.goto("/training/new");
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await settle(page);

  await expect(page.getByRole("button", { name: ASK })).toHaveCount(0);

  await page.getByLabel("관찰한 장면").fill(DEFAULT_CONTENT.observation);
  await expect(page.getByRole("button", { name: ASK })).toBeVisible();
});

test("구분 단계: 항목을 하나 넣은 뒤에 열린다", async ({ page }) => {
  await page.goto("/training/new");
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await settle(page);
  await page.getByLabel("관찰한 장면").fill(DEFAULT_CONTENT.observation);
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("2 / 7 구분")).toBeVisible();
  await settle(page);
  const ask = page.getByRole("button", { name: "분류가 헷갈리면 질문 하나 받기" });
  await expect(ask).toHaveCount(0);

  await page.getByLabel("추가할 항목").fill(DEFAULT_CONTENT.observationItem);
  await page.getByRole("button", { name: "항목 추가하기" }).click();
  await expect(ask).toBeVisible();
});

test("관찰 단계에서 실제로 질문 하나를 받는다", async ({ page }) => {
  test.slow(); // 실 제공자를 부른다.
  await page.goto("/training/new");
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await settle(page);
  await page.getByLabel("관찰한 장면").fill(DEFAULT_CONTENT.observation);

  await page.getByRole("button", { name: ASK }).click();

  /*
    무엇이 오든 화면이 침묵하지 않는다는 것이 요점이다 — 코치의 질문이든, Guardrail이
    걸러 규칙 기반으로 내려온 질문이든, 실패 안내든. 이 저장소에서 네 번 재발한 증상이
    "눌렀는데 아무 일도 일어나지 않는다"였다.
  */
  // 먼저 기다리는 중이라고 말해야 한다 — 최대 20초짜리 자리다.
  const waiting = page.getByText("다음 질문을 정리하고 있어요.");
  await expect(waiting).toBeVisible();

  // 그리고 기다림이 끝나면 질문이든 실패 안내든 **무언가**가 남아야 한다.
  await expect(waiting).toBeHidden({ timeout: 30_000 });
  await expect(
    page.locator("p.text-body-lg, p[role='alert']").filter({ hasText: /\S/ }).first(),
  ).toBeVisible();

  // 쓴 내용은 그대로 있어야 한다(원칙 7). 힌트를 부르며 서버에 확정했더라도
  // 화면의 문장이 사라지면 안 된다.
  await expect(page.getByLabel("관찰한 장면")).toHaveValue(DEFAULT_CONTENT.observation);
});

test("혼자 하기 모드에서는 어느 단계에도 버튼이 없다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "오늘은 코치 없이 해보기" }).click();
  await expect(page.getByText("오늘은 코치 없이 해보는 중")).toBeVisible();
  await settle(page);

  await page.getByLabel("관찰한 장면").fill(DEFAULT_CONTENT.observation);
  await expect(page.getByRole("button", { name: ASK })).toHaveCount(0);

  await page.getByRole("button", { name: "다음 질문으로" }).click();
  await expect(page.getByText("2 / 7 구분")).toBeVisible();
  await settle(page);
  await page.getByLabel("추가할 항목").fill(DEFAULT_CONTENT.observationItem);
  await page.getByRole("button", { name: "항목 추가하기" }).click();
  await expect(
    page.getByRole("button", { name: "분류가 헷갈리면 질문 하나 받기" }),
  ).toHaveCount(0);
});
