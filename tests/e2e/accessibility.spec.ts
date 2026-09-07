import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { resetActiveSession } from "./helpers/cleanup";
import {
  completeSelfAssessment,
  fillStagesUntilFeedback,
  fillStagesUntilQuestioning,
  finishSession,
} from "./helpers/training-flow";

/**
 * WCAG 2.2 AA 자동 검사 (DEVELOPMENT_PLAN.md §13 "axe-core (Playwright), 주요 화면 8종",
 * Phase 6 완료 조건 "WCAG 2.2 AA 자동 검사 통과 + 수동 항목 확인").
 *
 * 자동 검사가 사람 확인을 대신하지는 못한다 — axe가 잡는 것은 규칙으로 표현 가능한
 * 위반(대비, 이름 없는 컨트롤, 잘못된 ARIA, 랜드마크·제목 구조)뿐이다. 읽기 순서나
 * 문구의 적절성 같은 것은 여전히 §14-I 사람 검증이 필요하다. 다만 규칙으로 잡히는
 * 것을 사람이 매번 눈으로 확인할 이유는 없다.
 */

const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoA11yViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_AA_TAGS).analyze();

  // 위반이 있으면 규칙 id만이 아니라 어느 요소인지까지 남긴다 — 실패 로그만 보고
  // 고칠 수 있어야 한다.
  const summary = results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
  }));
  expect(summary, `${label} 화면의 WCAG 위반`).toEqual([]);
}

test.describe("로그인 없이 볼 수 있는 화면", () => {
  // global-setup이 저장한 로그인 쿠키를 그대로 쓰면 /auth/* 는 홈으로 리다이렉트된다
  // (proxy.ts의 REDIRECT_IF_AUTHED_PATHS). 이 화면들은 로그아웃 상태로 봐야 한다.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("로그인", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
    await expectNoA11yViolations(page, "로그인");
  });

  test("회원가입", async ({ page }) => {
    await page.goto("/auth/signup");
    await expect(page.getByRole("button", { name: "회원가입" })).toBeVisible();
    await expectNoA11yViolations(page, "회원가입");
  });

  test("온보딩", async ({ page }) => {
    await page.goto("/onboarding");
    await expectNoA11yViolations(page, "온보딩");
  });

  test("오프라인 폴백", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "오프라인이에요" })).toBeVisible();
    await expectNoA11yViolations(page, "오프라인");
  });
});

test.describe("로그인이 필요한 화면", () => {
  test.skip(
    !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
    "E2E_TEST_EMAIL/PASSWORD 미설정 — 로그인 필요한 E2E는 건너뜀 (.env.example 참고)",
  );

  test.beforeEach(async ({ request }) => {
    await resetActiveSession(request);
  });

  test("홈", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("오늘 다시 볼 장면")).toBeVisible();
    await expectNoA11yViolations(page, "홈");
  });

  test("기록 목록", async ({ page }) => {
    await page.goto("/history");
    await expect(page.getByRole("heading", { name: "기록" })).toBeVisible();
    await expectNoA11yViolations(page, "기록 목록");
  });

  test("성장", async ({ page }) => {
    await page.goto("/growth");
    await expect(page.getByRole("heading", { name: "성장" })).toBeVisible();
    await expectNoA11yViolations(page, "성장");
  });

  test("훈련 — 질문 단계", async ({ page }) => {
    await page.goto("/training/new");
    await fillStagesUntilQuestioning(page);
    await expectNoA11yViolations(page, "훈련(질문)");
  });

  test("훈련 — 돌아보기 단계(자기 점검 폼)", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/training/new");
    await fillStagesUntilFeedback(page);
    // 자기 점검 폼은 fieldset·legend·라디오 구조라 접근성 위험이 가장 큰 화면이다.
    await expectNoA11yViolations(page, "훈련(돌아보기)");
  });

  test("기록 상세", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/training/new");
    await fillStagesUntilFeedback(page);
    await completeSelfAssessment(page);
    await finishSession(page);
    await expectNoA11yViolations(page, "기록 상세");
  });
});
