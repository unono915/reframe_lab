import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { todayDateString } from "@/domain/templates/selection";
import { apiError } from "@/lib/errors";
import { createRouteContext, loadOwnedSnapshot, withIdempotency } from "../../../_lib/route-context";

const requestSchema = z.object({
  timezone: z.string().min(1),
  clientRequestId: z.string().min(1),
});

/**
 * DEVELOPMENT_PLAN.md §9.4 / §15.1 A "Revisit 세션의 템플릿": 원본 렌즈를 그대로
 * 승계한다(임시 가정). 원본 세션은 이 경로에서 절대 쓰지 않는다 — 새 세션만 만든다.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: originSessionId } = await params;
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;
  const { supabase, userId, repos } = ctx;

  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) return apiError("validation_error", parsed.error.issues[0]?.message);
  const { timezone, clientRequestId } = parsed.data;

  return withIdempotency(supabase, userId, clientRequestId, async () => {
    const origin = await loadOwnedSnapshot(repos, originSessionId, userId);
    if (!origin) return apiError("not_found");

    const snapshot = await repos.sessionRepository.createSession({
      userId,
      templateId: origin.session.templateId,
      trainingDate: todayDateString(timezone),
      timezone,
      clientGeneratedId: crypto.randomUUID(),
      originSessionId,
    });
    return NextResponse.json({ snapshot }, { status: 201 });
  });
}
