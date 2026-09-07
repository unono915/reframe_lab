import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findIdempotentResponse, recordIdempotentResponse } from "@/lib/idempotency";
import type { Database } from "@/lib/supabase/database.types";

/**
 * 멱등성 키는 "같은 요청이 재시도로 두 번 왔을 때 두 번 처리하지 않기" 위한 것이다.
 * 여기서 확인하는 것은 두 가지다:
 *
 * 1. 저장된 응답을 그대로 돌려주는가(중복 처리 방지의 본체).
 * 2. **만료된 키를 무시하는가.** 정리는 시간별 cron이 하지만 그 작업이 멈출 수 있고,
 *    그때 18일 전 스냅샷이 되살아나면 사용자가 방금 쓴 내용이 옛 응답으로 덮인다.
 *    조회 쪽 방어가 실제로 걸려 있는지 쿼리 자체로 확인한다(migration 0009).
 */

interface FakeQuery {
  calls: { method: string; args: unknown[] }[];
}

/** PostgREST 체이닝을 흉내내는 최소 스텁 — 마지막 단계에서 준비된 결과를 돌려준다. */
function fakeClient(result: { data: unknown; error: unknown }) {
  const q: FakeQuery = { calls: [] };
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gt", "upsert"]) {
    chain[method] = (...args: unknown[]) => {
      q.calls.push({ method, args });
      // upsert는 체인 끝에서 await되므로 thenable로도 동작해야 한다.
      return Object.assign(Promise.resolve(result), chain);
    };
  }
  chain.maybeSingle = () => {
    q.calls.push({ method: "maybeSingle", args: [] });
    return Promise.resolve(result);
  };
  const from = vi.fn(() => chain);
  return { client: { from } as unknown as SupabaseClient<Database>, q, from };
}

describe("findIdempotentResponse", () => {
  it("기록된 응답이 있으면 상태와 본문을 그대로 돌려준다", async () => {
    const { client } = fakeClient({
      data: { response_status: 201, response_body: { snapshot: "값" } },
      error: null,
    });
    await expect(findIdempotentResponse(client, "user-1", "req-1")).resolves.toEqual({
      status: 201,
      body: { snapshot: "값" },
    });
  });

  it("기록이 없으면 null — 호출자가 정상 처리하도록 둔다", async () => {
    const { client } = fakeClient({ data: null, error: null });
    await expect(findIdempotentResponse(client, "user-1", "req-1")).resolves.toBeNull();
  });

  it("만료 시각 필터를 반드시 건다 — cron이 멈춰도 옛 응답이 되살아나면 안 된다", async () => {
    const { client, q } = fakeClient({ data: null, error: null });
    await findIdempotentResponse(client, "user-1", "req-1");

    const gt = q.calls.find((c) => c.method === "gt");
    expect(gt, "expires_at 필터가 빠졌다").toBeDefined();
    expect(gt?.args[0]).toBe("expires_at");
    // 비교 기준이 '지금'이어야 한다 — 파싱 가능한 시각인지 확인한다.
    expect(Number.isNaN(Date.parse(String(gt?.args[1])))).toBe(false);
  });

  it("사용자와 요청 id 양쪽으로 좁힌다 — 다른 사용자의 키를 읽으면 안 된다", async () => {
    const { client, q } = fakeClient({ data: null, error: null });
    await findIdempotentResponse(client, "user-1", "req-1");

    const eqArgs = q.calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqArgs).toContainEqual(["user_id", "user-1"]);
    expect(eqArgs).toContainEqual(["client_request_id", "req-1"]);
  });

  it("조회 오류는 삼키지 않고 던진다", async () => {
    const { client } = fakeClient({ data: null, error: new Error("연결 실패") });
    await expect(findIdempotentResponse(client, "user-1", "req-1")).rejects.toThrow("연결 실패");
  });
});

describe("recordIdempotentResponse", () => {
  it("사용자·요청 id와 함께 응답을 기록한다", async () => {
    const { client, q } = fakeClient({ data: null, error: null });
    await recordIdempotentResponse(client, "user-1", "req-1", 200, { ok: true });

    const upsert = q.calls.find((c) => c.method === "upsert");
    expect(upsert?.args[0]).toMatchObject({
      user_id: "user-1",
      client_request_id: "req-1",
      response_status: 200,
      response_body: { ok: true },
    });
  });

  it("기록 실패는 던진다 — 조용히 넘어가면 중복 처리가 열린다", async () => {
    const { client } = fakeClient({ data: null, error: new Error("쓰기 실패") });
    await expect(
      recordIdempotentResponse(client, "user-1", "req-1", 200, {}),
    ).rejects.toThrow("쓰기 실패");
  });
});
