import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 로그인 없이 접근 가능한 경로. `/auth/*`는 통째로 공개다 — 그중 로그인·가입만
 * 아래에서 별도로 "이미 로그인된 사용자는 Home으로" 리다이렉트한다. 비밀번호
 * 재설정 완료(`/auth/reset-password/confirm`)와 이메일 인증 대기 화면은 세션이
 * 이미 있어도(임시 복구 세션이거나, 다른 탭에서 인증을 마쳐 폴링 중이거나) 그
 * 화면에 머물러야 하므로 이 리다이렉트 대상에서 제외한다.
 */
const PUBLIC_PREFIXES = ["/onboarding", "/auth", "/offline"];
const REDIRECT_IF_AUTHED_PATHS = ["/auth/login", "/auth/signup"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Next.js `middleware.ts`에서 매 요청마다 호출한다. 만료 임박한 auth 토큰을
 * 갱신하고(iOS standalone처럼 오래 열어 두는 세션에서 로그인이 조용히 끊기는 것을
 * 막는다), 로그인 필수 원칙(PRD/CLAUDE.md §7)에 따라 미인증 접근을 여기서 막는다.
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && REDIRECT_IF_AUTHED_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
