import { NextResponse, type NextRequest } from "next/server";
import { todayDateString } from "@/domain/templates/selection";
import { daysSince, suggestRevisitCandidate } from "@/domain/growth/revisit";
import { createRouteContext } from "../_lib/route-context";

/**
 * GET /api/home?timezone=Asia/Seoul — Home이 쓰는 카드 두 개만 계산해서 준다.
 *
 * 원래 Home은 `/api/history` 전체를 받아 클라이언트에서 골랐다. 두 계산 모두
 * 목록 전체가 있어야 해서(가장 최근 완료 기록 / 이미 다시 본 것을 뺀 가장 오래된
 * 후보) 그럴 만한 이유가 있었지만, 그 대가로 **매일 여는 화면이 기록 수에 비례해
 * 무거워졌다** — 36개 기록에서 이미 24KB였고 상한 100개까지 계속 자란다.
 *
 * 판정 자체는 `domain/growth/revisit.ts`의 순수 함수 그대로다. 서버와 클라이언트가
 * 같은 domain 함수를 부른다는 원칙(§4.1)을 지키면서 계산 위치만 옮겼다.
 */
export async function GET(request: NextRequest) {
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;
  const { userId, repos } = ctx;

  const timezone = request.nextUrl.searchParams.get("timezone") ?? "UTC";
  const today = todayDateString(timezone);
  const sessions = await repos.sessionRepository.listSessionSummariesForUser(userId, {
    limit: 100,
  });

  const recentRecord = sessions.find((s) => s.status === "completed") ?? null;
  const candidate = suggestRevisitCandidate(sessions, today);

  return NextResponse.json({
    recentRecord,
    revisitCandidate: candidate
      ? { session: candidate, days: daysSince(candidate, today) }
      : null,
  });
}
