import { NextResponse, type NextRequest } from "next/server";
import { createRouteContext } from "../_lib/route-context";

/** 한 번에 가져오는 기록 수. 화면이 한 번에 다 보여줄 수 있는 양보다 넉넉하게 잡는다. */
const PAGE_SIZE = 50;

/**
 * GET /api/history?offset=0 — 사용자의 세션 요약 목록(최신순, 상태 무관).
 *
 * 전체 스냅샷이 아니라 요약을 반환한다 — 목록 화면이 쓰지 않는 자식 산출물까지
 * 실어 보내면 기록이 쌓일수록 선형으로 느려진다(`SessionSummary` 주석 참고).
 *
 * 페이지를 나누는 이유는 성능만이 아니다. 예전에는 상한 100건에서 **말없이 잘렸다** —
 * 하루 한 번 쓰면 석 달이면 닿는 수치라, 그 뒤로는 자기가 쓴 기록 일부를 다시 볼
 * 방법이 없어진다. `hasMore`로 더 있다는 사실을 알리고 이어서 받게 한다.
 */
export async function GET(request: NextRequest) {
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;

  const rawOffset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  // 한 건 더 요청해서 다음 페이지가 있는지 판단한다 — 별도 count 쿼리를 만들지 않는다.
  const rows = await ctx.repos.sessionRepository.listSessionSummariesForUser(ctx.userId, {
    limit: PAGE_SIZE + 1,
    offset,
  });
  const hasMore = rows.length > PAGE_SIZE;

  return NextResponse.json({
    sessions: hasMore ? rows.slice(0, PAGE_SIZE) : rows,
    hasMore,
    nextOffset: hasMore ? offset + PAGE_SIZE : null,
  });
}
