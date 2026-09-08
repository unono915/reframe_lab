import { NextResponse, type NextRequest } from "next/server";
import { selectTemplateForDate, todayDateString } from "@/domain/templates/selection";
import { daysSince, suggestRevisitCandidate } from "@/domain/growth/revisit";
import type { SessionSummary } from "@/domain/types";
import { createRouteContext } from "../_lib/route-context";

/**
 * GET /api/home?timezone=Asia/Seoul — Home 화면이 필요한 것을 **한 번에** 준다.
 *
 * 두 번에 걸쳐 여기까지 왔다.
 *
 * 처음에 Home은 `/api/history` 전체를 받아 클라이언트에서 카드 두 개를 골랐다.
 * 두 계산 모두 목록 전체가 있어야 해서(가장 최근 완료 기록 / 이미 다시 본 것을 뺀
 * 가장 오래된 후보) 그럴 만한 이유가 있었지만, 그 대가로 **매일 여는 화면이 기록
 * 수에 비례해 무거워졌다** — 36개 기록에서 이미 24KB였고 계속 자랐다. 그래서 계산을
 * 서버로 옮겼다.
 *
 * 그러고도 Home은 요청을 세 번 했다. `sessions?status=active` → (그 결과를 보고)
 * `templates/today` → 그리고 이 라우트. **앞의 둘은 순서대로 기다려야 했다** —
 * 활성 세션이 있는지 알아야 오늘의 렌즈를 뽑을지 정할 수 있기 때문이다. 휴대폰
 * 회선에서 왕복 한 번이 100~300ms인 것을 생각하면, 매일 여는 화면이 오늘의 문장을
 * 보여주기까지 왕복 두 번을 기다리고 있었던 셈이다.
 *
 * 그 판단은 서버에서 하면 왕복이 필요 없다. 이제 조회 네 개를 서버에서 **병렬로**
 * 돌리고 한 번에 돌려준다. 클라이언트 왕복은 3 → 1이 된다.
 *
 * 판정 자체는 전부 `domain/`의 순수 함수 그대로다(`selectTemplateForDate`,
 * `suggestRevisitCandidate`). 서버와 클라이언트가 같은 domain 함수를 부른다는
 * 원칙(§4.1)을 지키면서 계산 위치만 옮겼다.
 *
 * `sessions?status=active`와 `templates/today`는 그대로 남는다 — 훈련 화면이
 * 세션을 복구할 때 여전히 쓴다.
 */
export async function GET(request: NextRequest) {
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;
  const { userId, repos } = ctx;

  const timezone = request.nextUrl.searchParams.get("timezone") ?? "UTC";
  const today = todayDateString(timezone);

  /*
    카드 두 개(최근 기록·다시 보기 제안)는 **없어도 되는 정보**다. 오늘의 렌즈와
    "이어서 하기" 여부는 이 화면이 존재하기 위한 필수 정보이므로 실패하면 오류를
    돌려주지만, 카드 때문에 화면 전체가 오류로 바뀌면 안 된다 — 합치기 전 두 요청이
    가지고 있던 성질을 그대로 유지한다.
  */
  const [activeSnapshot, templates, recentTemplateIds, summaries] = await Promise.all([
    repos.sessionRepository.getActiveSessionForUser(userId),
    repos.templateRepository.listActiveTemplates(),
    repos.sessionRepository.listRecentTemplateIds(userId, 5),
    repos.sessionRepository
      .listSessionSummariesForUser(userId, { limit: 100 })
      .catch((error: unknown) => {
        console.error("[home] 기록 카드 조회 실패 — 화면은 그대로 보여준다", error);
        return [] as SessionSummary[];
      }),
  ]);

  const activeSession = activeSnapshot?.session ?? null;
  const template = activeSession
    ? // 진행 중인 세션은 그때 고른 렌즈를 계속 쓴다. 이름만 붙이면 되므로 오늘의
      // 렌즈를 새로 뽑지 않는다.
      (templates.find((t) => t.id === activeSession.templateId) ?? null)
    : selectTemplateForDate({ date: today, userId, templates, recentTemplateIds });

  const recentRecord = summaries.find((s) => s.status === "completed") ?? null;
  const candidate = suggestRevisitCandidate(summaries, today);

  return NextResponse.json({
    activeSession,
    template,
    recentRecord,
    revisitCandidate: candidate
      ? { session: candidate, days: daysSince(candidate, today) }
      : null,
  });
}
