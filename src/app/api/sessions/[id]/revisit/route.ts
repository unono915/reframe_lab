import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resolveTimeZone, todayDateString } from "@/domain/templates/selection";
import { apiError } from "@/lib/errors";
import {
  createRouteContext,
  loadOwnedSnapshot,
  withIdempotency,
} from "../../../_lib/route-context";

const requestSchema = z.object({
  timezone: z.string().min(1),
  clientRequestId: z.string().min(1),
});

/**
 * DEVELOPMENT_PLAN.md §9.4 / §15.1 A "Revisit 세션의 템플릿": 원본 렌즈를 그대로
 * 승계한다(임시 가정). 원본 세션은 이 경로에서 절대 쓰지 않는다 — 새 세션만 만든다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: originSessionId } = await params;
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;
  const { supabase, userId, repos } = ctx;

  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success)
    return apiError("validation_error", parsed.error.issues[0]?.message);
  const { clientRequestId } = parsed.data;
  // 저장 전 정리는 세션 생성과 같은 이유다(`api/sessions/route.ts` 주석 참고).
  const timezone = resolveTimeZone(parsed.data.timezone);

  return withIdempotency(supabase, userId, clientRequestId, async () => {
    const origin = await loadOwnedSnapshot(repos, originSessionId, userId);
    if (!origin) return apiError("not_found");

    /*
      진행 중인 훈련이 있으면 거절한다.

      `createSession`은 활성 세션이 있으면 **그것을 그대로 돌려준다** — "오늘의 훈련
      시작"에서는 그게 맞는 동작이다(이어서 하기). 그런데 Revisit에서는 사용자가
      특정 기록을 다시 보겠다고 눌렀는데 **무관한 진행 중 세션**에 떨어진다.
      `originSessionId`도 없는 남의 세션이라, 화면상 아무 설명 없이 다른 훈련이 열린다.

      사용자당 활성 세션은 하나라는 제약은 그대로 두되, 그 사실을 말해준다.
    */
    const active = await repos.sessionRepository.getActiveSessionForUser(userId);
    if (active) {
      return apiError(
        "invalid_transition",
        "진행 중인 훈련이 있어요. 홈에서 이어서 마치거나 그만둔 뒤에 다시 시도해주세요.",
      );
    }

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
