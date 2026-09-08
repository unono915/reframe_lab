import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requireSupabaseEnv } from "./env";

/**
 * 로그인 없이 접근 가능한 경로. `/auth/*`는 통째로 공개다 — 그중 로그인·가입만
 * 아래에서 별도로 "이미 로그인된 사용자는 Home으로" 리다이렉트한다. 비밀번호
 * 재설정 완료(`/auth/reset-password/confirm`)와 이메일 인증 대기 화면은 세션이
 * 이미 있어도(임시 복구 세션이거나, 다른 탭에서 인증을 마쳐 폴링 중이거나) 그
 * 화면에 머물러야 하므로 이 리다이렉트 대상에서 제외한다.
 */
const PUBLIC_PREFIXES = ["/onboarding", "/auth", "/offline"];

/**
 * 온보딩을 이미 봤다는 표시. 보안 경계가 아니라 화면 흐름용이라 쿠키로 충분하다
 * (지웠다고 해서 잃는 것은 없다 — 소개 화면을 한 번 더 볼 뿐이다).
 */
const ONBOARDING_SEEN_COOKIE = "onboarding_seen";
const REDIRECT_IF_AUTHED_PATHS = ["/auth/login", "/auth/signup"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Next.js `middleware.ts`에서 매 요청마다 호출한다. 만료 임박한 auth 토큰을
 * 갱신하고(iOS standalone처럼 오래 열어 두는 세션에서 로그인이 조용히 끊기는 것을
 * 막는다), 로그인 필수 원칙(PRD/CLAUDE.md §7)에 따라 미인증 접근을 여기서 막는다.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  /**
   * 프록시(Vercel) 뒤에서는 원 요청의 프로토콜이 `x-forwarded-proto`로만 남는다 —
   * `request.nextUrl.protocol`은 내부 홉의 값일 수 있어 그것만 보면 안 된다.
   */
  const isHttps =
    request.headers.get("x-forwarded-proto") === "https" ||
    request.nextUrl.protocol === "https:";

  // non-null 단언(`!`)은 런타임에 아무 것도 막지 못한다 — 실제로 값이 없는 배포에서
  // undefined가 그대로 SDK까지 흘러가 매 요청이 500으로 죽었다(env.ts 주석 참고).
  const { url, anonKey } = requireSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
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
          // HTTPS로 들어온 요청에는 세션 쿠키에 Secure를 못 박는다 — 평문 연결로
          // 세션 토큰이 나가는 경로를 아예 닫는다.
          //
          // NODE_ENV로 판단하지 않는 이유: E2E는 프로덕션 빌드를 http://localhost로
          // 띄운다. NODE_ENV=production만 보고 Secure를 켜면 브라우저가 쿠키를
          // 저장하지 않아 로그인 자체가 막힌다. 실제 프로토콜로 판단해야 맞다.
          //
          // 이 쿠키는 `httpOnly`가 아니다 — @supabase/ssr의 브라우저 클라이언트가
          // 같은 쿠키에서 세션을 읽어야 하기 때문에 구조상 불가피하다. 그래서
          // XSS를 막는 쪽(CSP, HTML 주입 지점 없음)이 이 앱에서 특히 중요하다.
          response.cookies.set(name, value, {
            ...options,
            secure: isHttps || options?.secure,
          });
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    // API 요청은 리다이렉트하지 않는다. 예전에는 화면과 똑같이 로그인 페이지로
    // 307을 보냈는데, `fetch`는 그 리다이렉트를 따라가 **HTML을 받는다** — 호출부의
    // `response.json()`이 깨지면서 사용자에게는 "잠시 문제가 생겼어요"만 뜨고,
    // 정작 필요한 행동(다시 로그인)은 어디에도 안내되지 않았다. 오래 열어두는
    // iOS standalone PWA에서 토큰이 만료되면 정확히 그 상태로 갇힌다.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          errorCode: "unauthorized",
          message: "로그인이 풀렸어요. 다시 로그인해주세요.",
        },
        { status: 401 },
      );
    }
    // 처음 오는 사람은 로그인 폼이 아니라 소개 화면부터 본다(DESIGN.md §10.1 S-01,
    // PRD F-01). 이 화면은 만들어져 있었지만 **어디서도 연결되지 않아 도달할 수
    // 없었다** — URL을 직접 치는 사람만 볼 수 있었다.
    //
    // 루트로 들어온 경우에만 그렇게 한다. `/history` 같은 깊은 링크를 타고 온
    // 사람은 갈 곳이 분명하므로 로그인으로 보내고 `next`로 되돌려준다.
    if (pathname === "/" && !request.cookies.get(ONBOARDING_SEEN_COOKIE)) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    const loginUrl = new URL("/auth/login", request.url);
    // 쿼리까지 함께 기억한다. 경로만 남기면 `?solo=1`처럼 **무엇을 하려던 것인지가
    // 담긴 부분**이 로그인 과정에서 사라져, 돌아온 사용자는 자기가 고른 것과 다른
    // 화면을 보게 된다. 이 값은 돌아갈 때 `safeNextPath`가 다시 검사한다.
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (user && REDIRECT_IF_AUTHED_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
