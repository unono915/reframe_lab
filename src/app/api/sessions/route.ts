import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { todayDateString } from "@/domain/templates/selection";
import { apiError } from "@/lib/errors";
import { createRouteContext, withIdempotency } from "../_lib/route-context";

/** Postgres foreign_key_violation. 존재하지 않는 template_id를 보냈을 때만 나온다. */
const FOREIGN_KEY_VIOLATION = "23503";

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
  if (!parsed.success)
    return apiError("validation_error", parsed.error.issues[0]?.message);
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
    } catch (error) {
      // 예전에는 어떤 실패든 "템플릿을 확인해주세요"로 바꿔 400을 돌려줬다. 실제
      // 원인이 무엇이든 사용자를 엉뚱한 곳으로 보내고, 서버 문제를 클라이언트
      // 잘못으로 보고하는 셈이었다(400은 "네가 잘못 보냈다"는 뜻이다).
      //
      // 템플릿 id가 실제로 없을 때만 그렇게 말한다 — Postgres 23503(foreign key
      // violation)이 그 경우다. 나머지는 서버 문제로 알리고 원인을 로그에 남긴다.
      const code = (error as { code?: string } | null)?.code;
      if (code === FOREIGN_KEY_VIOLATION) {
        return apiError(
          "validation_error",
          "오늘의 렌즈를 찾을 수 없어요. 다시 시도해주세요.",
        );
      }
      console.error("[sessions] 세션 생성 실패", error);
      return apiError(
        "internal_error",
        "훈련을 시작하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    }
  });
}
