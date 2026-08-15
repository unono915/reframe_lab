import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * "다른 사용자 ID로 조회·수정·삭제가 차단되는" RLS 권한 테스트 (Phase 3 완료 조건).
 *
 * Postgres에 직접 연결해 Supabase가 PostgREST 요청마다 하는 것과 동일하게
 * `request.jwt.claims`를 세션 변수로 주입하고 `authenticated` 역할로 전환한다 —
 * Supabase의 공식 RLS 테스트 기법이며, Service Role Key나 실제 로그인 세션 없이도
 * 정책을 검증할 수 있다.
 *
 * `SUPABASE_DB_URL`이 없으면(기본 `.env.local`에는 없음 — Postgres 접속 문자열은
 * 별도로 발급받아야 한다) 이 테스트 파일 전체를 건너뛴다. CI에서 이 값을 시크릿으로
 * 주입하면 실제로 실행된다. 2026-08-15에 Supabase MCP `execute_sql`로 동일한 절차를
 * 수동 실행해 통과를 1차 확인했다(DEVELOPMENT_PLAN.md §Phase 3 검증 방법 참고).
 */
const dbUrl = process.env.SUPABASE_DB_URL;

describe.skipIf(!dbUrl)("RLS — 다른 사용자 접근 차단", () => {
  const sql = postgres(dbUrl ?? "", { max: 1 });
  const ownerId = randomUUID();
  const attackerId = randomUUID();
  const templateId = `rls-test-${randomUUID().slice(0, 8)}`;
  const sessionId = randomUUID();

  beforeAll(async () => {
    // 테스트 전용 auth.users 행 — 로컬 통합 테스트 DB에서만 실행된다는 전제.
    await sql`
      insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
      values
        (${ownerId}, 'authenticated', 'authenticated', ${`rls-test-owner-${ownerId}@example.test`}, '', now(), now(), now()),
        (${attackerId}, 'authenticated', 'authenticated', ${`rls-test-attacker-${attackerId}@example.test`}, '', now(), now(), now())
    `;
    await sql`
      insert into public.training_templates (id, title, prompt, lens_type, difficulty, version, active)
      values (${templateId}, 'RLS 테스트', 'x', 'repetition', 1, 1, false)
    `;
    await sql`
      insert into public.training_sessions
        (id, client_generated_id, user_id, template_id, training_date, timezone, status, current_stage, state_version)
      values
        (${sessionId}, ${"rls-test-client-id"}, ${ownerId}, ${templateId}, current_date, 'Asia/Seoul', 'observation', 'observation', 0)
    `;
  });

  afterAll(async () => {
    await sql`delete from public.training_sessions where id = ${sessionId}`;
    await sql`delete from public.training_templates where id = ${templateId}`;
    await sql`delete from auth.users where id in (${ownerId}, ${attackerId})`;
    await sql.end();
  });

  async function asUser(
    userId: string,
    fn: (tx: postgres.TransactionSql) => Promise<readonly Record<string, unknown>[]>,
  ): Promise<readonly Record<string, unknown>[]> {
    return sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
      await tx`set local role authenticated`;
      return fn(tx);
    });
  }

  it("소유자는 자신의 세션을 조회할 수 있다", async () => {
    const rows = await asUser(ownerId, (tx) => tx`select id from public.training_sessions where id = ${sessionId}`);
    expect(rows).toHaveLength(1);
  });

  it("다른 사용자는 조회 시 0건이 반환된다 (행 자체가 보이지 않음)", async () => {
    const rows = await asUser(attackerId, (tx) => tx`select id from public.training_sessions where id = ${sessionId}`);
    expect(rows).toHaveLength(0);
  });

  it("다른 사용자는 수정할 수 없다 (영향받은 행 0건)", async () => {
    const rows = await asUser(
      attackerId,
      (tx) =>
        tx`update public.training_sessions set current_stage = 'separation' where id = ${sessionId} returning id`,
    );
    expect(rows).toHaveLength(0);
  });

  it("다른 사용자는 삭제할 수 없다 (영향받은 행 0건)", async () => {
    const rows = await asUser(
      attackerId,
      (tx) => tx`delete from public.training_sessions where id = ${sessionId} returning id`,
    );
    expect(rows).toHaveLength(0);

    // 원 소유자에게는 여전히 존재해야 한다 — 삭제 시도가 조용히 성공한 게 아님을 확인.
    const stillThere = await asUser(ownerId, (tx) => tx`select id from public.training_sessions where id = ${sessionId}`);
    expect(stillThere).toHaveLength(1);
  });
});
