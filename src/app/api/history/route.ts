import { NextResponse } from "next/server";
import { createRouteContext } from "../_lib/route-context";

/**
 * GET /api/history — 사용자의 세션 요약 목록(최신순, 상태 무관). History·Growth·Home이
 * 같은 목록을 공유한다 — Growth는 `domain/growth/metrics.ts`가 이 중 completed만
 * 걸러 재계산한다(Growth Snapshot을 별도로 두지 않는 이유).
 *
 * 전체 스냅샷이 아니라 요약을 반환한다 — 목록 화면이 쓰지 않는 자식 산출물까지
 * 실어 보내면 기록이 쌓일수록 선형으로 느려진다(`SessionSummary` 주석 참고).
 */
export async function GET() {
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;

  const sessions = await ctx.repos.sessionRepository.listSessionSummariesForUser(
    ctx.userId,
    100,
  );
  return NextResponse.json({ sessions });
}
