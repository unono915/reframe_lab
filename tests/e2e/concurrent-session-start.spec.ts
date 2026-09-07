import { expect, test } from "@playwright/test";
import { resetActiveSession } from "./helpers/cleanup";

/**
 * "오늘의 훈련 시작"을 두 번 거의 동시에 눌렀을 때의 회귀 테스트.
 *
 * DB에는 "사용자당 활성 세션 1개"를 강제하는 부분 유니크 인덱스가 있고
 * (`training_sessions_one_active_per_user`), Repository는 만들기 전에 활성 세션이
 * 있는지 먼저 조회한다. 그 **조회와 삽입 사이**에 다른 요청이 먼저 세션을 만들면
 * 인덱스가 뒤늦은 쪽을 막는다 — 인덱스는 제 역할을 한 것이고, 빠져 있던 것은
 * 경쟁에서 진 쪽의 처리였다. 그대로 두면 사용자에게는 아무 잘못이 없는데
 * "오늘의 훈련 시작"이 원인 없이 실패한다.
 *
 * 실제로 2026-09-08 E2E 로그에 `duplicate key value violates unique constraint
 * "training_sessions_one_active_per_user"`가 찍혀 있었다. 느린 기기에서 버튼이
 * 두 번 눌리거나 재시도가 겹치면 재현된다 — iOS Safari의 탭 지연을 생각하면
 * 실사용에서 못 볼 일이 아니다.
 *
 * `createSession`은 원래 멱등하기로 되어 있다. 두 요청 모두 **같은 세션**을 받아야
 * 하고, 어느 쪽도 오류가 되어서는 안 된다.
 */
test.skip(
  !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
  "E2E_TEST_EMAIL/PASSWORD 미설정 — 로그인 필요한 E2E는 건너뜀 (.env.example 참고)",
);

test.beforeEach(async ({ request }) => {
  await resetActiveSession(request);
});

test("훈련 시작을 동시에 두 번 눌러도 한 세션으로 모인다", async ({ request }) => {
  const templatesRes = await request.get("/api/templates");
  expect(templatesRes.ok()).toBe(true);
  const { templates } = (await templatesRes.json()) as {
    templates: { id: string }[];
  };
  const templateId = templates[0]?.id;
  expect(templateId).toBeTruthy();

  function start() {
    return request.post("/api/sessions", {
      data: {
        // clientRequestId를 서로 다르게 준다 — 같은 값이면 멱등성 캐시가 대신
        // 막아버려서 정작 확인하려는 DB 경쟁 구간에 닿지 못한다.
        clientRequestId: crypto.randomUUID(),
        clientGeneratedId: crypto.randomUUID(),
        templateId,
        timezone: "Asia/Seoul",
      },
    });
  }

  const [first, second] = await Promise.all([start(), start()]);

  // 활성 세션이 이미 있을 때도 201로 돌려주는 것이 이 라우트의 기존 규약이다.
  expect(first.status(), await first.text()).toBe(201);
  expect(second.status(), await second.text()).toBe(201);

  const firstBody = (await first.json()) as { snapshot: { session: { id: string } } };
  const secondBody = (await second.json()) as { snapshot: { session: { id: string } } };
  expect(secondBody.snapshot.session.id).toBe(firstBody.snapshot.session.id);
});
