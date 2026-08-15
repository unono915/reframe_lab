import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { pauseSession } from "@/domain/training/state-machine";
import { apiError, type ApiErrorCode } from "@/lib/errors";
import { createRouteContext, loadOwnedSnapshot, withIdempotency } from "../../../_lib/route-context";

const requestSchema = z.object({
  expectedStateVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
});

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

    const result = pauseSession(current.session, parsed.data.expectedStateVersion);
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
