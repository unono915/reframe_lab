import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { todayDateString } from "@/domain/templates/selection";
import { apiError } from "@/lib/errors";
import { createRouteContext, withIdempotency } from "../_lib/route-context";

const createSessionSchema = z.object({
  clientGeneratedId: z.string().min(1),
  templateId: z.string().min(1),
  timezone: z.string().min(1),
  clientRequestId: z.string().min(1),
});

/** GET /api/sessions?status=active — DESIGN.md §9.3 세션 복구의 서버 쪽 절반. */
export async function GET(request: NextRequest) {
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;
  const { userId, repos } = ctx;

  const status = request.nextUrl.searchParams.get("status");
  if (status === "active") {
    const snapshot = await repos.sessionRepository.getActiveSessionForUser(userId);
    return NextResponse.json({ snapshot });
  }
  return apiError("validation_error", "status=active만 지원합니다.");
}

/**
 * POST /api/sessions — 활성 세션이 이미 있으면 새로 만들지 않고 그것을 돌려준다
 * (`training_sessions_one_active_per_user` 제약과 대칭 — DEVELOPMENT_PLAN.md §9.2).
 */
export async function POST(request: NextRequest) {
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;
  const { supabase, userId, repos } = ctx;

  const json = await request.json().catch(() => null);
  const parsed = createSessionSchema.safeParse(json);
  if (!parsed.success) return apiError("validation_error", parsed.error.issues[0]?.message);
  const { clientGeneratedId, templateId, timezone, clientRequestId } = parsed.data;

  return withIdempotency(supabase, userId, clientRequestId, async () => {
    try {
      const snapshot = await repos.sessionRepository.createSession({
        userId,
        templateId,
        trainingDate: todayDateString(timezone),
        timezone,
        clientGeneratedId,
      });
      return NextResponse.json({ snapshot }, { status: 201 });
    } catch {
      return apiError("validation_error", "세션을 만들지 못했어요. 템플릿을 확인해주세요.");
    }
  });
}
