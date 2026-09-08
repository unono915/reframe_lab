import { expect, test } from "@playwright/test";
import { resetActiveSession } from "./helpers/cleanup";
import { fillStagesUntilQuestioning, settle } from "./helpers/training-flow";

/**
 * 최소 요건을 못 채운 사람을 실패로 처리하지 않는 경로의 회귀 테스트 (PRD §6.3:
 * "접근성, 반복적인 막힘 또는 AI 미사용 경로에서는 최소 개수 예외를 허용할 수 있다.
 * 예외 사유와 힌트 사용을 기록하고 사용자를 실패 처리하지 않는다.").
 *
 * 이 경로는 네 단계에 구현돼 있는데 **자동 검증이 하나도 없었다.** 그리고 이런
 * 종류의 경로가 조용히 죽는 것을 이 저장소는 이미 겪었다 — 온보딩 화면은 만들어져
 * 있었지만 어디서도 연결되지 않아 도달할 수 없었다.
 *
 * 질문 단계의 예외는 Level 2 힌트를 **실제로 받아야** 열린다 — 그게 "반복적인 막힘"의
 * 정의다. 실 제공자를 세 번 부르면 느리고 답도 매번 달라지므로, 코치 응답만 현재
 * 스냅샷으로 흉내 내 클라이언트 쪽 판정을 결정적으로 확인한다. 실제 제공자로 도는
 * 경로는 브라우저와 DB로 따로 확인했다(AGENTS.md §3-D).
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

/**
 * 앞의 두 힌트만 흉내 내고, **Level 2 힌트는 진짜로 받는다.**
 *
 * 왜 전부 흉내 내지 않는가 — 예외 경로의 조건은 서버가 판정하고, 서버는 "이 단계에서
 * Level 2 힌트를 실제로 받았는가"를 코치 상호작용 기록으로 본다. 요청을 전부
 * 가로채면 그 기록이 생기지 않아 **화면만 확인하고 서버 판정은 하나도 검증하지 못한다**
 * (실제로 그렇게 만들었다가 테스트가 통과하지 못해 알아챘다).
 *
 * 흉내 내는 응답의 스냅샷은 진짜를 쓴다. 클라이언트가 응답의 스냅샷을 그대로 상태로
 * 삼기 때문에, 가짜를 주면 그 뒤 화면이 실제 데이터와 어긋난다.
 */
async function stubFirstTwoHints(page: import("@playwright/test").Page): Promise<void> {
  let seen = 0;
  await page.route("**/api/sessions/*/coach", async (route) => {
    seen += 1;
    if (seen > 2) {
      await route.fallback();
      return;
    }
    const current = await page.request.get("/api/sessions?status=active");
    const body = (await current.json()) as { snapshot: unknown };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ question: "지금 장면에서 무엇이 반복되나요?", ...body }),
    });
  });
}

test.describe("질문 단계 — 세 번 막힌 뒤에야 예외가 열린다", () => {
  // `page.route` 가로채기는 Service Worker가 먼저 요청을 집으면 닿지 않는다
  // (WebKit에서 실제로 그랬다 — `ai-failure-fallback.spec.ts`와 같은 함정).
  test.use({ serviceWorkers: "block" });

  test("Level 2 힌트를 본 뒤에 예외 입력란이 나타난다", async ({ page }) => {
    test.slow(); // 마지막 힌트는 실 제공자를 부른다.
    await stubFirstTwoHints(page);
    await page.goto("/training/new");
    await fillStagesUntilQuestioning(page);
    await settle(page);

    await page.getByLabel("새 질문").fill("왜 이 사람만 반복해서 늦을까?");
    await page.getByRole("button", { name: "질문 추가하기" }).click();
    await settle(page);

    const exceptionField = page.getByLabel(
      "질문이 더 떠오르지 않는다면, 이유를 적어주세요",
    );

    // 첫 힌트는 Level 0이다. 가장 강한 단계를 보기 전에는 문이 열리지 않는다.
    await page.getByRole("button", { name: "힌트 보기" }).click();
    await settle(page);
    await expect(exceptionField).toHaveCount(0);

    await page.getByRole("button", { name: "힌트 보기" }).click();
    await settle(page);
    await expect(exceptionField).toHaveCount(0);

    // 세 번째가 Level 2 — 여기서부터 "반복적인 막힘"으로 본다. 이 요청만 진짜로
    // 나가므로 실 제공자 응답을 기다린다(최대 20초).
    await page.getByRole("button", { name: "힌트 보기" }).click();
    await expect(exceptionField).toBeVisible({ timeout: 30_000 });

    await exceptionField.fill("더는 다른 각도가 떠오르지 않아요");
    await page.getByRole("button", { name: "다음 질문으로" }).click();

    await expect(page.getByText("4 / 7 탐색")).toBeVisible();
  });
});
