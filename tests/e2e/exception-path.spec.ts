import { expect, test } from "@playwright/test";
import { resetActiveSession } from "./helpers/cleanup";
import { settle } from "./helpers/training-flow";

/**
 * 최소 요건을 못 채운 사람을 실패로 처리하지 않는 경로의 회귀 테스트 (PRD §6.3:
 * "접근성, 반복적인 막힘 또는 AI 미사용 경로에서는 최소 개수 예외를 허용할 수 있다.
 * 예외 사유와 힌트 사용을 기록하고 사용자를 실패 처리하지 않는다.").
 *
 * 이 경로는 네 단계에 구현돼 있는데 **자동 검증이 하나도 없었다.** 그리고 이런
 * 종류의 경로가 조용히 죽는 것을 이 저장소는 이미 겪었다 — 온보딩 화면은 만들어져
 * 있었지만 어디서도 연결되지 않아 도달할 수 없었다.
 *
 * 여기서 확인하는 것은 관찰·구분 두 단계다. 질문 단계의 예외는 Level 2 힌트를 실제로
 * 받아야 열리므로(그게 "반복적인 막힘"의 정의다) 실제 제공자 호출 3회가 필요해 이
 * 파일에 넣지 않았다 — 그 경로는 브라우저와 DB로 직접 확인했다(AGENTS.md §3-D).
 *
 * 막힌 사람이 쓰는 길이므로, **막혔다는 사실이 기록에 남는지**까지 본다. 그냥 넘겨주고
 * 끝이면 나중에 "이 사람은 요건을 채웠다"와 구분되지 않는다.
 */
test.skip(
  !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
  "E2E_TEST_EMAIL/PASSWORD 미설정 — 로그인 필요한 E2E는 건너뜀 (.env.example 참고)",
);

test.beforeEach(async ({ request }) => {
  await resetActiveSession(request);
});

test("관찰을 구체화하지 못해도 사유를 남기면 이어갈 수 있다", async ({ page }) => {
  await page.goto("/training/new");
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await settle(page);

  // 아무것도 쓰지 않은 채로는 넘어갈 수 없다 — 예외는 "그냥 통과"가 아니다.
  await page.getByRole("button", { name: "다음 질문으로" }).click();
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();

  await page.getByRole("button", { name: "지금은 구체화하기 어려워요" }).click();
  // 사유 없이 누르면 여전히 막힌다.
  await page.getByRole("button", { name: "다음 질문으로" }).click();
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();

  await page
    .getByLabel("지금은 이 이상 구체화하기 어려운 이유")
    .fill("오늘 본 장면이 잘 떠오르지 않아요");
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("2 / 7 구분")).toBeVisible();
});

test("확인한 사실이 없어도 사유를 남기면 이어갈 수 있다", async ({ page }) => {
  await page.goto("/training/new");
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await settle(page);
  await page.getByLabel("관찰한 장면").fill("팀 채팅에 아무도 답을 안 한다");
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("2 / 7 구분")).toBeVisible();
  await settle(page);

  // 항목을 하나도 확인하지 않은 상태에서는 넘어갈 수 없다.
  await page.getByRole("button", { name: "다음 질문으로" }).click();
  await expect(page.getByText("2 / 7 구분")).toBeVisible();

  await page
    .getByLabel("확인된 사실이 아직 부족하다면, 이유를 적어주세요")
    .fill("아직 확인된 것이 없어요");
  await page.getByRole("button", { name: "다음 질문으로" }).click();

  await expect(page.getByText("3 / 7 질문")).toBeVisible();
});

test("예외로 넘어간 사실이 기록에 남는다", async ({ page, request }) => {
  await page.goto("/training/new");
  await expect(page.getByText("1 / 7 관찰")).toBeVisible();
  await settle(page);

  await page.getByRole("button", { name: "지금은 구체화하기 어려워요" }).click();
  await page
    .getByLabel("지금은 이 이상 구체화하기 어려운 이유")
    .fill("지금은 떠오르지 않아요")
    .then(() => page.getByRole("button", { name: "다음 질문으로" }).click());
  await expect(page.getByText("2 / 7 구분")).toBeVisible();

  const res = await request.get("/api/sessions?status=active");
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as {
    snapshot: {
      stageResponses: { stage: string; promptKey: string; content: string }[];
    } | null;
  };
  const reasons = body.snapshot?.stageResponses.filter(
    (r) => r.promptKey === "observation_limit_reason",
  );
  // 사유가 남아야 나중에 "요건을 채웠다"와 구분된다(PRD §6.3).
  expect(reasons?.length).toBeGreaterThan(0);
  expect(reasons?.[0]?.content).toContain("떠오르지 않아요");
});
