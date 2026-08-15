import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * `save_training_session_snapshot` RPC(supabase/migrations/0003~0006)의 원자적
 * 저장·재조정(reconciliation) 검증. 이 RPC는 세션 스냅샷 전체를 "자식 테이블
 * 삭제 후 재삽입"으로 반영해 삭제된 항목(예: 질문 하나를 지운 경우)도 정확히
 * 반영되게 한다 — REST 다중 호출로는 원자성이 보장되지 않아 Postgres 함수
 * 하나로 묶었다(CLAUDE.md 원칙 7).
 *
 * `SUPABASE_DB_URL`이 없으면 skip한다. 2026-08-15에 Supabase MCP `execute_sql`로
 * 동일한 시나리오(최초 저장 → 항목 삭제 재저장 → 순환 FK 확인 → cleanup)를 실제
 * 프로젝트에 수동 실행해 통과 확인했다 — 그 과정에서 버그 2건을 발견해 고쳤다
 * (0005: JSON null과 SQL NULL 혼동, 0006: ai_feedbacks/problem_definition_versions
 * 순환 참조 삭제 순서).
 */
const dbUrl = process.env.SUPABASE_DB_URL;

describe.skipIf(!dbUrl)("save_training_session_snapshot RPC", () => {
  const sql = postgres(dbUrl ?? "", { max: 1 });
  const ownerId = randomUUID();
  const templateId = `rpc-test-${randomUUID().slice(0, 8)}`;
  const sessionId = randomUUID();
  const observationId = randomUUID();
  const pdv1Id = randomUUID();
  const pdv2Id = randomUUID();
  const feedbackId = randomUUID();

  beforeAll(async () => {
    await sql`
      insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
      values (${ownerId}, 'authenticated', 'authenticated', ${`rpc-test-${ownerId}@example.test`}, '', now(), now(), now())
    `;
    await sql`
      insert into public.training_templates (id, title, prompt, lens_type, difficulty, version, active)
      values (${templateId}, 'RPC 테스트', 'x', 'repetition', 1, 1, false)
    `;
  });

  afterAll(async () => {
    await sql`delete from public.training_sessions where id = ${sessionId}`;
    await sql`delete from public.training_templates where id = ${templateId}`;
    await sql`delete from auth.users where id = ${ownerId}`;
    await sql.end();
  });

  async function callRpc(overrides: {
    questionIds: string[];
    observationItemIds: string[];
  }) {
    const now = new Date().toISOString();
    await sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: ownerId, role: "authenticated" })}, true)`;
      await tx`set local role authenticated`;
      await tx`
        select public.save_training_session_snapshot(
          ${sql.json({
            id: sessionId,
            client_generated_id: "rpc-test-client",
            user_id: ownerId,
            template_id: templateId,
            training_date: now.slice(0, 10),
            timezone: "Asia/Seoul",
            status: "feedback",
            current_stage: "feedback",
            last_active_stage: null,
            state_version: 1,
            ai_call_count: 1,
            origin_session_id: "",
            started_at: now,
            last_active_at: now,
            completed_at: "",
            abandoned_at: "",
            created_at: now,
            updated_at: now,
          })},
          ${sql.json({
            id: observationId,
            raw_text: "관찰 원문",
            context_when: null,
            context_where: null,
            version: 1,
            created_at: now,
            updated_at: now,
          })},
          ${sql.json(
            overrides.observationItemIds.map((id, i) => ({
              id,
              text: `사실 ${i}`,
              type: "fact",
              author_type: "user",
              user_confirmed: true,
              item_order: i,
            })),
          )},
          ${sql.json([])},
          ${sql.json(
            overrides.questionIds.map((id, i) => ({
              id,
              text: `질문 ${i}`,
              author_type: "user",
              lens_type: null,
              question_order: i,
              is_priority: i === 0,
              priority_reason: i === 0 ? "이유" : null,
              hint_level_used: 0,
            })),
          )},
          ${sql.json([])},
          ${sql.json([])},
          ${sql.json([
            {
              id: pdv1Id,
              version_number: 1,
              text: "정의 v1",
              author_type: "user",
              change_reason: null,
              based_on_feedback_id: null,
              created_at: now,
            },
            {
              id: pdv2Id,
              version_number: 2,
              text: "정의 v2",
              author_type: "user",
              change_reason: "피드백 반영",
              based_on_feedback_id: feedbackId,
              created_at: now,
            },
          ])},
          ${sql.json([
            {
              id: feedbackId,
              problem_definition_version_id: pdv1Id,
              dimensions: { clarity: { status: "shown", evidence: "근거" } },
              strength: "강점",
              improvement_focus: "개선점",
              unverified_assumption: "가정",
              next_question: "다음 질문",
              provider: "mock",
              model: "mock-v1",
              prompt_version: "test",
              schema_version: "1",
              is_stale: false,
              created_at: now,
            },
          ])},
          ${sql.json([])}
        )
      `;
    });
  }

  it("최초 저장 시 모든 자식 행이 생성되고 순환 FK(based_on_feedback_id)가 해결된다", async () => {
    await callRpc({
      questionIds: [randomUUID(), randomUUID()],
      observationItemIds: [randomUUID(), randomUUID()],
    });

    const pdvRows = await sql`
      select based_on_feedback_id from public.problem_definition_versions where id = ${pdv2Id}
    `;
    expect(pdvRows[0]?.based_on_feedback_id).toBe(feedbackId);

    const feedbacks = await sql`select id from public.ai_feedbacks where session_id = ${sessionId}`;
    expect(feedbacks).toHaveLength(1);
  });

  it("재저장 시 스냅샷에서 빠진 항목은 삭제되고(재조정) 남은 항목만 유지된다", async () => {
    const keptQuestion = randomUUID();
    const keptItem = randomUUID();

    await callRpc({
      questionIds: [randomUUID(), randomUUID()],
      observationItemIds: [randomUUID(), randomUUID()],
    });
    await callRpc({
      questionIds: [keptQuestion],
      observationItemIds: [keptItem],
    });

    const questions = await sql`select id from public.questions where session_id = ${sessionId}`;
    expect(questions.map((r) => r.id)).toEqual([keptQuestion]);

    const items = await sql`
      select id from public.observation_items where observation_id = ${observationId}
    `;
    expect(items.map((r) => r.id)).toEqual([keptItem]);
  });
});
