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
  return { ok: true, supabase, userId: user.id, repos: createSupabaseRepositories(supabase) };
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
  if (response.ok) {
    const body = await response.clone().json();
    await recordIdempotentResponse(supabase, userId, clientRequestId, response.status, body);
  }
  return response;
}
