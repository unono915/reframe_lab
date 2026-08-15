import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js `middleware.ts`에서 매 요청마다 호출한다. 만료 임박한 auth 토큰을
 * 갱신하고 갱신된 쿠키를 응답에 실어 보낸다 — Server Component는 쿠키를 쓸 수
 * 없으므로 이 갱신 경로가 없으면 iOS standalone처럼 오래 열어 두는 세션에서
 * 로그인이 조용히 끊긴다.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // 토큰 갱신 트리거 — 반환값의 user는 여기서 쓰지 않지만, 호출 자체가
  // 만료 임박 세션을 갱신시킨다(Supabase SSR 공식 패턴).
  await supabase.auth.getUser();

  return response;
}
