import { NextResponse, type NextRequest } from "next/server";
import { selectTemplateForDate, todayDateString } from "@/domain/templates/selection";
import { createRouteContext } from "../../_lib/route-context";

/** GET /api/templates/today?timezone=Asia/Seoul — DESIGN.md §9.1, §9.2. */
export async function GET(request: NextRequest) {
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;
  const { userId, repos } = ctx;

  const timezone = request.nextUrl.searchParams.get("timezone") ?? "UTC";
  const [templates, recentTemplateIds] = await Promise.all([
    repos.templateRepository.listActiveTemplates(),
    repos.sessionRepository.listRecentTemplateIds(userId, 5),
  ]);

  const chosen = selectTemplateForDate({
    date: todayDateString(timezone),
    userId,
    templates,
    recentTemplateIds,
  });
  return NextResponse.json({ template: chosen });
}
