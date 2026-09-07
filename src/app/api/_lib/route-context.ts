import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrainingSessionSnapshot } from "@/domain/types";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { apiError } from "@/lib/errors";
import { findIdempotentResponse, recordIdempotentResponse } from "@/lib/idempotency";

/**
 * 모든 Route Handler가 공유하는 준비 단계: 인증 세션에서 userId를 얻는다
 * (클라이언트가 보낸 값은 신뢰하지 않는다 — DEVELOPMENT_PLAN.md §6.3 원칙 6).
 * `app/api/**`는 레이어 규칙상 `lib/repositories/**`를 직접 import할 수 있는
 * 유일한 위치다(Route Handler가 그 경계 자체이므로).
 */
export async function createRouteContext(): Promise<
  | {
      ok: true;
      supabase: SupabaseClient<Database>;
      userId: string;
      repos: ReturnType<typeof createSupabaseRepositories>;
    }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: apiError("unauthorized") };
  return {
    ok: true,
    supabase,
    userId: user.id,
    repos: createSupabaseRepositories(supabase),
  };
}

/**
 * RLS가 이미 다른 사용자의 세션을 걸러내므로, "존재하지 않음"과 "내 것이 아님"은
 * 여기서도 구분하지 않고 둘 다 404로 통일한다 — 존재 여부 자체를 노출하지 않기 위함.
 */
export async function loadOwnedSnapshot(
  repos: ReturnType<typeof createSupabaseRepositories>,
  sessionId: string,
  userId: string,
): Promise<TrainingSessionSnapshot | null> {
  const snapshot = await repos.sessionRepository.getSnapshot(sessionId);
  if (!snapshot || snapshot.session.userId !== userId) return null;
  return snapshot;
}

/**
 * `clientRequestId`가 이미 처리됐으면 그 결과를 그대로 반환하고 `fn`을 실행하지
 * 않는다. 성공 응답(2xx)만 기록한다 — 실패는 재시도가 그대로 다시 시도되어야 한다.
 */
export async function withIdempotency(
  supabase: SupabaseClient<Database>,
  userId: string,
  clientRequestId: string,
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const cached = await findIdempotentResponse(supabase, userId, clientRequestId);
  if (cached) return NextResponse.json(cached.body, { status: cached.status });

  const response = await fn();
  if (!response.ok) return response;

  // `response.clone()`으로 본문을 두 갈래로 나눠 읽지 않는다. 한쪽을 서버에서 읽는
  // 동안 클라이언트로 나가는 쪽이 **잘린 채** 전달되는 일이 실제로 있었다 — 상태는
  // 200인데 브라우저의 `response.json()`이 실패하는 응답이 20번에 2번꼴로 나왔다.
  // 그 결과 클라이언트는 저장이 성공한 줄 알면서도 최신 스냅샷을 받지 못했다(원칙 7).
  // 본문은 한 번만 읽고, 클라이언트에게는 그 값으로 새 응답을 만들어 돌려준다.
  const body: unknown = await response.json();

  try {
    await recordIdempotentResponse(
      supabase,
      userId,
      clientRequestId,
      response.status,
      body,
    );
  } catch (error) {
    // 멱등성 키 기록은 뒷정리다. 여기서 실패했다고 이미 커밋된 변경을 오류로
    // 되돌려 알리면, 사용자는 성공한 저장을 실패로 보고 다시 시도하게 된다.
    console.error("[idempotency] 응답 기록 실패 — 요청 자체는 성공했다", error);
  }

  return NextResponse.json(body, { status: response.status });
}
