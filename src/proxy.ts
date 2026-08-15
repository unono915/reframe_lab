import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16에서 `middleware.ts`는 폐기되고 `proxy.ts`로 이름이 바뀌었다
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 * 동작은 동일 — 세션 쿠키 갱신 + 인증 게이트(lib/supabase/middleware.ts).
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 정적 자원과 Serwist Service Worker 라우트는 세션 갱신이 필요 없으므로 제외한다.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|serwist|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
