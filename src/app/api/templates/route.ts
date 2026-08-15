import { NextResponse } from "next/server";
import { createRouteContext } from "../_lib/route-context";

/** GET /api/templates — 활성 템플릿 전체 목록(세션 복구 시 템플릿 상세 조회용). */
export async function GET() {
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;

  const templates = await ctx.repos.templateRepository.listActiveTemplates();
  return NextResponse.json({ templates });
}
