import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
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
