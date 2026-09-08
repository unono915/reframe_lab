import { expect, test } from "@playwright/test";

/**
 * 로그인하지 않은 요청이 데이터베이스에서 **아무것도 볼 수 없는지** 확인한다.
 *
 * 이 앱의 데이터 경계는 RLS다. Route Handler는 Service Role을 아예 쓰지 않고 전부
 * 사용자 세션으로만 동작하므로(CLAUDE.md §3-9), 정책이 무너지면 앱 코드가 아무리
 * 멀쩡해도 남의 기록이 새어 나간다. 그런데 그 경계를 검증하는
 * `tests/integration/rls.test.ts`는 `SUPABASE_DB_URL`이 있을 때만 돌고, CI에는 그
 * 시크릿이 없어서 **한 번도 자동 실행된 적이 없다.**
 *
 * 이 파일은 Postgres 접속 문자열 없이 공개 키만으로 확인할 수 있는 부분을 맡는다 —
 * "익명은 아무것도 못 본다". 소유자/타인 구분까지는 못 보지만(계정이 둘 필요하다),
 * 가장 크게 잘못될 수 있는 경로는 여기다. 정책이 실수로 `anon`까지 열리거나
 * 테이블 하나에 RLS를 켜는 것을 빠뜨리면 이 테스트가 먼저 깨진다.
 *
 * 앱을 거치지 않고 Supabase REST에 직접 묻는다 — 확인하려는 것이 앱의 판단이 아니라
 * 데이터베이스 자체의 판단이기 때문이다.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test.skip(
  !SUPABASE_URL || !ANON_KEY,
  "NEXT_PUBLIC_SUPABASE_URL/ANON_KEY 미설정 — RLS 확인을 건너뜀",
);

/** 사용자 데이터가 들어 있는 표 전부. 하나라도 빠지면 검사에 구멍이 생긴다. */
const USER_DATA_TABLES = [
  "training_sessions",
  "observations",
  "observation_items",
  "questions",
  "perspectives",
  "reframes",
  "problem_definition_versions",
  "stage_responses",
  "ai_feedbacks",
  "coach_interactions",
  "session_events",
  "idempotency_keys",
];

test("로그인하지 않으면 어떤 표에서도 한 줄도 읽히지 않는다", async ({ request }) => {
  for (const table of USER_DATA_TABLES) {
    const response = await request.get(
      `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=5`,
      { headers: { apikey: ANON_KEY!, Authorization: `Bearer ${ANON_KEY}` } },
    );

    // PostgREST는 RLS로 걸러진 결과를 200 + 빈 배열로 돌려준다. 거부(401/403)도
    // 똑같이 안전하므로 둘 다 통과로 본다 — 확인할 것은 "행이 나오지 않는다"이다.
    if (response.status() === 200) {
      const rows = (await response.json()) as unknown[];
      expect(rows, `${table}에서 익명 요청에 행이 나왔다`).toEqual([]);
    } else {
      expect(response.status(), `${table}의 응답 상태`).toBeGreaterThanOrEqual(400);
    }
  }
});

test("템플릿도 로그인 없이는 읽히지 않는다", async ({ request }) => {
  // 개인 데이터는 아니지만 이 앱은 로그인 필수라(PRD/CLAUDE.md §7), 정책도 그렇게
  // 걸려 있다. 여기가 열리면 "로그인 필수"가 화면에만 있는 규칙이 된다.
  const response = await request.get(
    `${SUPABASE_URL}/rest/v1/training_templates?select=id&limit=5`,
    { headers: { apikey: ANON_KEY!, Authorization: `Bearer ${ANON_KEY}` } },
  );

  if (response.status() === 200) {
    expect(await response.json()).toEqual([]);
  } else {
    expect(response.status()).toBeGreaterThanOrEqual(400);
  }
});
