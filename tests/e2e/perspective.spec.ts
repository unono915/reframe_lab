import { expect, test } from "@playwright/test";
import { resetActiveSession } from "./helpers/cleanup";
import { DEFAULT_CONTENT, settle } from "./helpers/training-flow";

/**
 * 재정의 단계의 첫 절반, "관점 탐색"의 회귀 테스트.
 *
 * PRD §8 5단계는 **다른 렌즈로 다시 보기가 먼저이고 프레임 작성이 그다음**이다. 그런데
 * 이 앞 절반은 자동 검증이 없었고(완주 헬퍼가 곧바로 프레임을 쓴다), 실제 DB에도
 * 관점 메모가 3줄뿐이었다 — 손으로 눌러본 흔적만 있었다는 뜻이다.
 *
 * 게다가 저장된 메모는 **어디에서도 다시 보이지 않았다.** 기록에도 성장에도 없어서,
 * 나중에 읽으면 프레임이 어디서 나왔는지가 사라진다. 여기서는 쓴 것이 저장되고
 * 기록에 남는 것까지 확인한다.
 */
test.skip(
  !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
  "E2E_TEST_EMAIL/PASSWORD 미설정 — 로그인 필요한 E2E는 건너뜀 (.env.example 참고)",
);

test.beforeEach(async ({ request }) => {
  await resetActiveSession(request);
});

const PERSPECTIVE_NOTE = "늦는 사람 입장에서는 앞 일정이 늘 늦게 끝난다";

test("다른 렌즈로 본 메모가 저장되고 기록에도 남는다", async ({ page }) => {
  test.slow();
  await page.goto("/training/new");

  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await settle(page);
  await page.getByLabel("관찰한 장면").fill(DEFAULT_CONTENT.observation);
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("2 / 7 구분")).toBeVisible();
  await settle(page);
  await page.getByLabel("추가할 항목").fill(DEFAULT_CONTENT.observationItem);
  await page.getByRole("button", { name: "항목 추가하기" }).click();
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("3 / 7 질문")).toBeVisible();
  await settle(page);
  const questionField = page.getByLabel("새 질문");
  for (const q of DEFAULT_CONTENT.questions) {
    await questionField.fill(q);
    await page.getByRole("button", { name: "질문 추가하기" }).click();
  }
  await page.getByRole("button", { name: "핵심 질문으로 고르기" }).first().click();
  await page.getByLabel("이 질문을 고른 이유").fill(DEFAULT_CONTENT.priorityReason);
  await page.getByRole("button", { name: "핵심 질문으로 선택" }).click();
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("4 / 7 탐색")).toBeVisible();
  await settle(page);
  await page
    .getByLabel(/가장 직접적인 영향을 받는 사람/)
    .fill(DEFAULT_CONTENT.exploration.affected);
  await page.getByLabel(/어떤 상황·맥락/).fill(DEFAULT_CONTENT.exploration.context);
  await page
    .getByLabel(/무엇이 어렵거나 달라졌나요/)
    .fill(DEFAULT_CONTENT.exploration.impact);
  await page
    .getByLabel(/아직 확실히 모르는 부분/)
    .fill(DEFAULT_CONTENT.exploration.unknown);
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("5 / 7 재정의")).toBeVisible();
  await settle(page);

  // ── 여기가 검증 대상: 렌즈를 고르고 그 렌즈로 본 것을 적는다 ──
  await page.getByRole("button", { name: "가장 불리한 입장" }).click();
  await page.getByLabel("이 렌즈로 보니 새로 보이는 것").fill(PERSPECTIVE_NOTE);
  await page.getByRole("button", { name: "발견한 내용 추가하기" }).click();

  // 화면에 남아야 다음 프레임을 쓸 때 참고할 수 있다.
  await expect(page.getByText(PERSPECTIVE_NOTE)).toBeVisible();

  const reframeField = page.getByLabel("대안 문제 프레임");
  for (const r of DEFAULT_CONTENT.reframes) {
    await reframeField.fill(r);
    await page.getByRole("button", { name: "프레임 추가하기" }).click();
  }
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("6 / 7 정의")).toBeVisible();
  await settle(page);
  await page.getByLabel("현재의 문제 정의").fill(DEFAULT_CONTENT.definition);
  await page.getByRole("button", { name: "이대로 기록하기" }).click();
  await expect(page.getByText("7 / 7 돌아보기")).toBeVisible();

  // 기록으로 열었을 때도 남아 있어야 한다 — 프레임만 남으면 그것이 어디서 나왔는지
  // 알 수 없다.
  const sessionId = (page.url().split("/training/")[1] ?? "").split("?")[0];
  await page.goto(`/result/${sessionId}`);
  await expect(page.getByText("관점 탐색")).toBeVisible();
  await expect(page.getByText(PERSPECTIVE_NOTE)).toBeVisible();
  await expect(page.getByText("가장 불리한 입장")).toBeVisible();
});
