import { NextResponse } from "next/server";
import { createRouteContext } from "../_lib/route-context";

/**
 * GET /api/history — 사용자의 전체 세션(최신순, 상태 무관). History 화면과 Growth
 * 화면이 같은 목록을 공유한다 — Growth는 `domain/growth/metrics.ts`가 이 중
 * completed만 걸러 재계산한다(Growth Snapshot을 별도로 두지 않는 이유).
 */
export async function GET() {
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;

  const sessions = await ctx.repos.sessionRepository.listSessionsForUser(ctx.userId, 100);
  return NextResponse.json({ sessions });
}
