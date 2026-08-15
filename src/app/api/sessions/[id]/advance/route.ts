import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { advanceStage } from "@/domain/training/state-machine";
import { apiError, type ApiErrorCode } from "@/lib/errors";
import { createRouteContext, loadOwnedSnapshot, withIdempotency } from "../../../_lib/route-context";

const advanceRequestSchema = z.object({
  expectedStateVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
});

/**
 * DEVELOPMENT_PLAN.md §7.3 7단계 Flow의 실제 구현. `domain/training/state-machine.ts`가
 * 유일한 판정자다 — 여기서는 소유권 확인과 저장만 하고, "넘어갈 수 있는가"는 절대
 * 서버가 따로 판단하지 않는다.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;
  const { supabase, userId, repos } = ctx;

  const json = await request.json().catch(() => null);
  const parsed = advanceRequestSchema.safeParse(json);
  if (!parsed.success) return apiError("validation_error", parsed.error.issues[0]?.message);
  const { expectedStateVersion, clientRequestId } = parsed.data;

  return withIdempotency(supabase, userId, clientRequestId, async () => {
    const current = await loadOwnedSnapshot(repos, sessionId, userId);
    if (!current) return apiError("not_found");

    const result = advanceStage(current, expectedStateVersion);
    if (!result.ok) {
      return apiError(result.errorCode as ApiErrorCode, result.message, { snapshot: current });
    }

    // 초안은 IndexedDB(브라우저)에만 있어 서버가 직접 지울 수 없다 — 응답의
    // `clearedStage`를 보고 클라이언트가 그 단계의 초안을 지운다(work unit 9).
    const saved = await repos.sessionRepository.saveSnapshot({
      ...current,
      session: result.session,
    });
    return NextResponse.json({
      snapshot: saved,
      viaException: result.viaException,
      clearedStage: current.session.currentStage,
    });
  });
}
