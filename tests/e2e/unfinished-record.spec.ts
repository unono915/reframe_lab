import { expect, test } from "@playwright/test";
import { resetActiveSession } from "./helpers/cleanup";
import {
  DEFAULT_CONTENT,
  fillStagesUntilQuestioning,
  settle,
} from "./helpers/training-flow";

/**
 * 아직 마치지 않은 기록을 열었을 때의 회귀 테스트.
 *
 * 기록 목록은 완료된 것만 담지 않는다 — 진행 중이거나 보류한 세션도 함께 보여주고,
 * 누르면 기록 상세로 온다. 그런데 그 화면은 모든 경우에 "지금의 생각을 기록했어요"
 * 라고 말하고 있었다. **아직 쓰는 중인 사람에게 끝났다고 말한 것이고, 이어서 할
 * 방법도 거기 없었다** — 홈으로 돌아가는 길을 스스로 찾아야 했다.
 *
 * 게다가 그 자리에 있던 "이 장면 다시 생각하기"는 진행 중인 세션에서는 서버가
 * 거절한다("진행 중인 훈련이 있어요"). 사용자가 알아야 할 정보가 아니라, 우리가
 * 애초에 물어보지 말았어야 할 질문이었다.
 */
test.skip(
  !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
  "E2E_TEST_EMAIL/PASSWORD 미설정 — 로그인 필요한 E2E는 건너뜀 (.env.example 참고)",
);

test.beforeEach(async ({ request }) => {
  await resetActiveSession(request);
});

test("마치지 않은 기록은 끝났다고 말하지 않고, 이어서 할 길을 준다", async ({ page }) => {
  await page.goto("/training/new");
  await fillStagesUntilQuestioning(page);
  await settle(page);
  const sessionId = (page.url().split("/training/")[1] ?? "").split("?")[0];
  expect(sessionId).toBeTruthy();

  await page.goto(`/result/${sessionId}`);

  await expect(page.getByText("아직 마치지 않은 기록이에요.")).toBeVisible();
  await expect(page.getByText("지금의 생각을 기록했어요.")).toHaveCount(0);
  // 진행 중인 세션에서는 서버가 거절할 동작을 아예 내놓지 않는다.
  await expect(page.getByRole("button", { name: "이 장면 다시 생각하기" })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "이어서 하기" }).click();

  await expect(page).toHaveURL(new RegExp(`/training/${sessionId}`));
  // 떠난 자리에서 그대로 이어진다.
  await expect(page.getByText("3 / 7 질문")).toBeVisible();
});

test("없는 기록을 열면 막히지 않고 목록으로 돌아갈 수 있다", async ({ page }) => {
  /*
    지운 기록의 주소를 다시 열거나 링크가 오래된 경우가 여기로 온다. 다시 시도해도
    같은 답이라 재시도 버튼은 의미가 없는데, 예전에는 문구만 있고 갈 곳이 없었다.
  */
  await page.goto("/result/00000000-0000-0000-0000-000000000000");

  await expect(page.getByText("찾을 수 없어요", { exact: false })).toBeVisible();
  // 다시 시도해도 같은 답이라 그 버튼은 없어야 한다.
  await expect(page.getByRole("button", { name: "다시 시도" })).toHaveCount(0);
  await page.getByRole("button", { name: "기록 목록으로" }).click();

  await expect(page).toHaveURL(/\/history$/);
});

test("여기서 그만두면 기록은 남고, 다음 훈련을 새로 시작할 수 있다", async ({
  page,
  request,
}) => {
  /*
    PRD §6.2는 "사용자는 세션을 명시적으로 보류하거나 포기할 수 있다"고 정하는데, 그
    경로가 서버·도메인에는 있고 **화면에는 없었다.** 활성 세션은 하나뿐이라, 오늘
    시작해놓고 마음이 바뀐 사람에게 남은 선택지는 끝까지 하거나 쓴 것을 통째로
    지우는 것뿐이었다.
  */
  await page.goto("/training/new");
  await fillStagesUntilQuestioning(page);
  await settle(page);
  const sessionId = (page.url().split("/training/")[1] ?? "").split("?")[0];

  await page.goto(`/result/${sessionId}`);
  await page.getByRole("button", { name: "여기서 그만두기" }).click();
  await page.getByRole("button", { name: "그만두기", exact: true }).click();

  // 기록은 남는다 — 지운 것이 아니다.
  await expect(page.getByText("중단됨")).toBeVisible();
  await expect(page.getByText(DEFAULT_CONTENT.observation)).toBeVisible();
  // 되살릴 수 없는 상태이므로 이어서 하기는 사라진다.
  await expect(page.getByRole("button", { name: "이어서 하기" })).toHaveCount(0);

  // 활성 세션이 비었으니 새 훈련을 시작할 수 있다 — 이것이 이 경로의 요점이다.
  const active = await request.get("/api/sessions?status=active");
  expect(((await active.json()) as { snapshot: unknown }).snapshot).toBeNull();
});
