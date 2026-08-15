import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resumeSession } from "@/domain/training/state-machine";
import { apiError, type ApiErrorCode } from "@/lib/errors";
import { createRouteContext, loadOwnedSnapshot, withIdempotency } from "../../../_lib/route-context";

const requestSchema = z.object({
  expectedStateVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
});

/** DESIGN.md §9.2·§9.3: "/training/:id 진입 자체가 '이어서 하기' 행동이다." */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;
  const { supabase, userId, repos } = ctx;

  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) return apiError("validation_error", parsed.error.issues[0]?.message);

  return withIdempotency(supabase, userId, parsed.data.clientRequestId, async () => {
    const current = await loadOwnedSnapshot(repos, sessionId, userId);
    if (!current) return apiError("not_found");

    const result = resumeSession(current.session, parsed.data.expectedStateVersion);
    if (!result.ok) {
      return apiError(result.errorCode as ApiErrorCode, result.message, { snapshot: current });
    }

    const saved = await repos.sessionRepository.saveSnapshot({
      ...current,
      session: result.session,
    });
    return NextResponse.json({ snapshot: saved });
  });
}
