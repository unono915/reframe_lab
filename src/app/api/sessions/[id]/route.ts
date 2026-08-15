import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { createRouteContext, loadOwnedSnapshot } from "../../_lib/route-context";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;

  const snapshot = await loadOwnedSnapshot(ctx.repos, sessionId, ctx.userId);
  if (!snapshot) return apiError("not_found");
  return NextResponse.json({ snapshot });
}

/** 개별 기록 삭제(History) — Phase 3 완료 조건: "삭제 후 History가 일관되게 반영". */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;

  const snapshot = await loadOwnedSnapshot(ctx.repos, sessionId, ctx.userId);
  if (!snapshot) return apiError("not_found");

  await ctx.repos.sessionRepository.deleteSession(sessionId);
  return new NextResponse(null, { status: 204 });
}
