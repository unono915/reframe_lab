import { expect, type Page, test } from "@playwright/test";
import { resetActiveSession } from "./helpers/cleanup";

/**
 * Phase 5 완료 조건: History·Growth·Revisit·삭제가 실제로 동작하는지 확인한다.
 * 특히 "원본이 삭제될 때 Revisit 세션이 살아남는지"는 라이브 브라우저 검증에서
 * 실제로 재현된 버그(origin_session_id FK가 ON DELETE 절 없이 걸려 있어 한 번이라도
 * Revisit된 세션은 삭제가 항상 실패했다 — migration 0008로 ON DELETE SET NULL 수정)의
 * 회귀 테스트다.
 */
test.skip(
  !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
  "E2E_TEST_EMAIL/PASSWORD 미설정 — 로그인 필요한 E2E는 건너뜀 (.env.example 참고)",
);

test.beforeEach(async ({ request }) => {
  await resetActiveSession(request);
});

async function settle(page: Page) {
  await page.waitForTimeout(200);
}

async function completeSessionViaSelfCheck(page: Page, observationText: string) {
  await page.goto("/training/new");
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await settle(page);
  await page.getByLabel("관찰한 장면").fill(observationText);
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("2 / 7 구분")).toBeVisible();
  await settle(page);
  await page.getByLabel("추가할 항목").fill("확인된 사실 하나");
  await page.getByRole("button", { name: "항목 추가하기" }).click();
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("3 / 7 질문")).toBeVisible();
  await settle(page);
  const questionField = page.getByLabel("새 질문");
  for (const q of ["질문 1?", "질문 2?", "질문 3?"]) {
    await questionField.fill(q);
    await page.getByRole("button", { name: "질문 추가하기" }).click();
  }
  await page.getByRole("button", { name: "핵심 질문으로 고르기" }).first().click();
  await page.getByLabel("이 질문을 고른 이유").fill("가장 근본적이라서");
  await page.getByRole("button", { name: "핵심 질문으로 선택" }).click();
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("4 / 7 탐색")).toBeVisible();
  await settle(page);
  await page.getByLabel(/가장 직접적인 영향을 받는 사람/).fill("나");
  await page.getByLabel(/어떤 상황·맥락/).fill("일상");
  await page.getByLabel(/무엇이 어렵거나 달라졌나요/).fill("불편함이 생겼다");
  await page.getByLabel(/아직 확실히 모르는 부분/).fill("모르겠다");
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("5 / 7 재정의")).toBeVisible();
  await settle(page);
  const reframeField = page.getByLabel("대안 문제 프레임");
  await reframeField.fill("대안 프레임 1");
  await page.getByRole("button", { name: "프레임 추가하기" }).click();
  await reframeField.fill("대안 프레임 2");
  await page.getByRole("button", { name: "프레임 추가하기" }).click();
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("6 / 7 정의")).toBeVisible();
  await settle(page);
  await page.getByLabel("현재의 문제 정의").fill("현재 가장 타당한 문제 정의");
  await page.getByRole("button", { name: "이대로 기록하기" }).click();

  await expect(page.getByText("7 / 7 돌아보기")).toBeVisible();
  await settle(page);
  for (const label of [
    "실제 장면이나 확인된 사실에서 출발했나요?",
    "누가 어떤 상황에서 겪는 문제인지 드러나나요?",
    "원하는 것과 방해 요소, 결과가 구분되나요?",
    "확인되지 않은 원인을 단정하지 않았나요?",
    "지나치게 넓거나 특정 해결책으로 고정되지 않았나요?",
    "무엇을 더 확인해야 하는지 알 수 있나요?",
  ]) {
    await page.getByLabel(label).check();
  }
  await page.getByRole("button", { name: "체크리스트 완료로 표시" }).click();
  await page.getByRole("button", { name: "이대로 완료하기" }).click();
  await expect(page).toHaveURL(/\/result\//);
}

test("완료한 기록이 History·Growth에 나타난다", async ({ page }) => {
  await completeSessionViaSelfCheck(page, "History Growth 검증용 관찰 문장");

  await page.goto("/history");
  // 여러 브라우저 프로젝트가 같은 공유 E2E 계정에 기록을 쌓으므로, 동일 문구를 쓴
  // 이전 실행이 남아 있으면 2개 이상 매칭될 수 있다 — 존재 여부만 확인한다.
  await expect(page.getByText("History Growth 검증용 관찰 문장").first()).toBeVisible();

  await page.goto("/growth");
  await expect(page.getByText(/이번 주에 \d+번의 생각을 기록했어요\./)).toBeVisible();
});

test("다시 생각하기(Revisit)는 새 세션을 만들고, 원본을 삭제해도 그 세션은 남는다", async ({
  page,
}) => {
  await completeSessionViaSelfCheck(page, "Revisit 삭제 회귀 검증용 관찰 문장");
  const originUrl = page.url();

  await page.getByRole("button", { name: "이 장면 다시 생각하기" }).click();
  await expect(page).toHaveURL(/\/training\//);
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();

  // Revisit 세션을 활성 상태로 남겨두면 다음 테스트의 beforeEach가 정리하므로,
  // 여기서는 원본으로 돌아가 삭제만 검증한다.
  await page.goto(originUrl);
  await expect(page.getByRole("button", { name: "이 기록 삭제하기" })).toBeVisible();
  await page.getByRole("button", { name: "이 기록 삭제하기" }).click();
  await expect(page.getByRole("button", { name: "삭제 확정" })).toBeVisible();
  await page.getByRole("button", { name: "삭제 확정" }).click();

  // 삭제가 FK 오류로 실패하면 이 페이지 이동 자체가 일어나지 않는다 — 회귀 지점.
  await expect(page).toHaveURL("/history");
  await expect(page.getByText("Revisit 삭제 회귀 검증용 관찰 문장")).not.toBeVisible();
});
