import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * `client_request_id`가 이미 처리된 적이 있으면 그때의 응답을 그대로 돌려주고,
 * 없으면 null을 반환한다 — 호출자가 정상적으로 처리한 뒤 `recordIdempotentResponse`로
 * 기록한다. 사용자별로 격리된다(RLS: user_id = auth.uid()).
 *
 * 만료된 키는 없는 것으로 본다. 정리는 시간별 cron(`purge_expired_idempotency_keys`,
 * migration 0009)이 하지만, 그 작업이 멈춰도 18일 전 응답이 되살아나면 안 되므로
 * 조회 시점에서도 한 번 더 거른다.
 */
export async function findIdempotentResponse(
  client: SupabaseClient<Database>,
  userId: string,
  clientRequestId: string,
): Promise<{ status: number; body: unknown } | null> {
  const { data, error } = await client
    .from("idempotency_keys")
    .select("response_status, response_body")
    .eq("user_id", userId)
    .eq("client_request_id", clientRequestId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { status: data.response_status, body: data.response_body };
}

export async function recordIdempotentResponse(
  client: SupabaseClient<Database>,
  userId: string,
  clientRequestId: string,
  status: number,
  body: unknown,
): Promise<void> {
  // 같은 clientRequestId가 경합 상태로 두 번 들어와도(원칙 7과 같은 이유로) 나중 것이
  // 이겨도 무방하다 — 둘 다 같은 처리 결과를 기록하려는 것이기 때문이다.
  const { error } = await client.from("idempotency_keys").upsert({
    user_id: userId,
    client_request_id: clientRequestId,
    response_status: status,
    response_body:
      body as Database["public"]["Tables"]["idempotency_keys"]["Insert"]["response_body"],
  });
  if (error) throw error;
}
