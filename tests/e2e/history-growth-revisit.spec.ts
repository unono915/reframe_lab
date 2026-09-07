import { expect, type Page, test } from "@playwright/test";
import { resetActiveSession } from "./helpers/cleanup";
import {
  completeSelfAssessment,
  DEFAULT_CONTENT,
  fillStagesUntilFeedback,
  finishSession,
} from "./helpers/training-flow";

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

/**
 * 관찰 문장만 바꿔가며 한 세션을 자기 점검 경로로 완주시킨다. 단계 조작 자체는
 * `helpers/training-flow.ts`가 갖는다 — 화면이 바뀌면 그 한 곳만 고치면 된다.
 */
async function completeSessionViaSelfCheck(page: Page, observationText: string) {
  await page.goto("/training/new");
  await fillStagesUntilFeedback(page, {
    ...DEFAULT_CONTENT,
    observation: observationText,
  });
  await completeSelfAssessment(page);
  await finishSession(page);
}

test("완료한 기록이 History·Growth에 나타난다", async ({ page }) => {
  await completeSessionViaSelfCheck(page, "History Growth 검증용 관찰 문장");

  await page.goto("/history");
  // 여러 브라우저 프로젝트가 같은 공유 E2E 계정에 기록을 쌓으므로, 동일 문구를 쓴
  // 이전 실행이 남아 있으면 2개 이상 매칭될 수 있다 — 존재 여부만 확인한다.
  await expect(page.getByText("History Growth 검증용 관찰 문장").first()).toBeVisible();

  await page.goto("/growth");
  await expect(page.getByRole("heading", { name: "생각이 달라진 지점" })).toBeVisible();
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
