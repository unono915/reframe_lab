import { expect, test } from "@playwright/test";
import { resetActiveSession } from "./helpers/cleanup";
import {
  completeSelfAssessment,
  fillStagesUntilFeedback,
  fillStagesUntilQuestioning,
  finishSession,
} from "./helpers/training-flow";

/**
 * P1-6 전이 프로브 — "오늘은 코치 없이 해보기".
 *
 * 이 경로는 PRD §1.6-7("AI 없이도 향상되어야 한다")을 관측할 **유일한 수단**인데,
 * 그동안 자동 검증이 하나도 없었다. 그런데도 이미 한 번 깨진 적이 있다: 세션 로딩
 * 응답이 뒤늦게 도착해 방금 저장한 표식을 덮어써서, 사용자가 링크를 눌렀는데도
 * 화면이 평소와 똑같았다(`src/app/training/[sessionId]/page.tsx`의 URL 유지 주석).
 * 증상이 "아무 일도 안 일어남"이라 눈으로 보고 알아채기 어려운 종류다.
 *
 * 그래서 세 가지를 확인한다.
 *   1. 켜지는가 — 링크를 누르면 이 세션이 실제로 혼자 하기로 표시되는가
 *   2. 남는가 — 새로고침해도 유지되는가(표식이 서버에 있어야만 가능하다)
 *   3. 세는가 — 혼자 완주한 기록이 Growth에 반영되는가
 *
 * 3이 특히 중요하다. 이 표식은 화면 장식이 아니라 지표의 입력이고, `aiCallCount`만
 * 보고 세면 제공자 연결 전의 과거 기록까지 "혼자 해냄"으로 집계돼 허위 신호가 뜬다
 * (실제로 18번이 잘못 잡힌 적이 있다).
 */
test.skip(
  !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
  "E2E_TEST_EMAIL/PASSWORD 미설정 — 로그인 필요한 E2E는 건너뜀 (.env.example 참고)",
);

const SOLO_BADGE = "오늘은 코치 없이 해보는 중";

test.beforeEach(async ({ request }) => {
  await resetActiveSession(request);
});

test("코치 없이 시작하면 AI 도움이 사라지고, 새로고침해도 그대로다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "오늘은 코치 없이 해보기" }).click();

  await expect(page.getByText(SOLO_BADGE)).toBeVisible();
  await fillStagesUntilQuestioning(page);
  // 질문 단계는 힌트 버튼이 있는 유일한 자리다. 혼자 하기로 했으면 없어야 한다.
  await expect(page.getByRole("button", { name: "힌트 보기" })).toHaveCount(0);

  /*
    표식이 서버 스냅샷에 반영되면 URL에서 `?solo=1`이 빠진다. 파라미터가 남아 있다는
    것은 곧 "아직 저장되지 않았다"는 뜻이므로, 이 단언은 표식이 실제로 서버까지
    갔는지를 화면 문구와 별개로 확인해준다.
  */
  await expect(page).toHaveURL(/\/training\/[^?]+$/);

  await page.reload();
  // 새로고침은 클라이언트 상태를 전부 버린다 — 여기서 배지가 살아 있으면 표식이
  // 메모리가 아니라 DB에 있다는 뜻이다.
  await expect(page.getByText(SOLO_BADGE)).toBeVisible();
  await expect(page.getByRole("button", { name: "힌트 보기" })).toHaveCount(0);
});

test("코치 없이도 끝까지 갈 수 있고, 그 기록이 성장 화면에 남는다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "오늘은 코치 없이 해보기" }).click();
  await expect(page.getByText(SOLO_BADGE)).toBeVisible();

  await fillStagesUntilFeedback(page);
  await completeSelfAssessment(page);

  // 돌아보기 단계의 AI 영역 자체가 없어야 한다. 자기 점검이 오늘의 확인이다.
  await expect(page.getByText("코치의 시선과 견줘보기")).toHaveCount(0);
  await expect(page.getByText("오늘은 코치 없이 해보기로 했어요.")).toBeVisible();

  await finishSession(page);

  await page.goto("/growth");
  await expect(page.getByText("혼자 해낸 기록")).toBeVisible();
});
