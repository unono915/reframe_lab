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
test.skip(
  !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
  "E2E_TEST_EMAIL/PASSWORD 미설정 — 로그인 필요한 E2E는 건너뜀 (.env.example 참고)",
);

test.beforeEach(async ({ request }) => {
  await resetActiveSession(request);
});

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
