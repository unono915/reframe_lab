import { NextResponse, type NextRequest } from "next/server";
import { todayDateString } from "@/domain/templates/selection";
import { computeGrowthMetrics } from "@/domain/growth/metrics";
import { createRouteContext } from "../_lib/route-context";

/**
 * Growth가 보는 기간. 하루 한 번 쓰는 앱이라 1년치에 해당한다.
 *
 * 이 값이 화면에 직접 드러나지는 않지만 **주장에는 영향을 준다** — `computeShift`가
 * 받은 기록을 앞뒤 절반으로 갈라 "생각이 달라진 지점"을 계산하기 때문에, 몇 건을
 * 넘겨주느냐가 곧 비교 구간이다. 그래서 목록 화면의 페이지 크기에 딸려 정해지지
 * 않도록 여기에 따로 적어 둔다.
 */
const GROWTH_WINDOW = 365;

/**
 * GET /api/growth?timezone=Asia/Seoul — Growth 화면이 쓰는 지표를 계산해서 준다.
 *
 * 원래 Growth는 `/api/history`를 그대로 받아 클라이언트에서 계산했다. 그런데
 * History에 페이지네이션이 들어가면서 한 번에 50건만 오게 됐고, **화면에 아무
 * 표시 없이 분석 구간이 절반으로 줄었다.** 목록의 페이지 크기와 지표의 관측
 * 구간은 서로 다른 이유로 정해지는 값인데 한 엔드포인트를 공유하는 바람에 묶여
 * 있었던 것이다.
 *
 * 계산은 `domain/growth/metrics.ts`의 같은 순수 함수 그대로다 — 서버와 클라이언트가
 * 같은 domain 함수를 부른다는 원칙(§4.1)을 지키면서 위치만 옮겼다. 덤으로 전송량이
 * 기록 수와 무관한 고정 크기가 된다(`/api/home`과 같은 이유).
 */
export async function GET(request: NextRequest) {
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;
  const { userId, repos } = ctx;

  const timezone = request.nextUrl.searchParams.get("timezone") ?? "UTC";
  const sessions = await repos.sessionRepository.listSessionSummariesForUser(userId, {
    limit: GROWTH_WINDOW,
  });

  return NextResponse.json({
    metrics: computeGrowthMetrics(sessions, todayDateString(timezone)),
    // "가장 최근 기록 보기" 링크용. 목록 전체를 보내지 않기 위해 id만 뽑아 준다.
    latestSessionId: sessions.find((s) => s.status === "completed")?.id ?? null,
  });
}
