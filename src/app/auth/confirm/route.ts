import { type NextRequest, NextResponse } from "next/server";
import { readConfirmLink } from "@/lib/auth/confirm-link";
import { safeNextPath } from "@/lib/auth/next-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Supabase Auth 이메일 Link(가입 확인·비밀번호 재설정)가 최종적으로 도착하는 곳.
 * 링크의 두 가지 모양과 그 이유는 `lib/auth/confirm-link.ts`에 적어 두었다.
 *
 * ⚠️ `code` 모양을 받지 않던 동안, Supabase 기본 메일 템플릿으로 가입한 사람은
 * **인증이 실제로 끝난 그 순간에** "링크가 만료됐거나 이미 사용됐어요"를 봤다.
 * 2026-09-09에 실제로 그런 계정이 있었다 — `email_confirmed_at`은 채워졌는데
 * 세션·리프레시 토큰은 하나도 만들어지지 않았다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  // 확인 링크의 목적지도 열린 리다이렉트가 되지 않도록 이 앱 안의 경로만 허용한다.
  const next = safeNextPath(searchParams.get("next"));
  const link = readConfirmLink(searchParams);

  const back = (reason: string) =>
    NextResponse.redirect(`${origin}/auth/login?verify_error=${reason}`);

  if (link.kind === "failed") return back("expired");

  const supabase = await createSupabaseServerClient();

  if (link.kind === "otp") {
    const { error } = await supabase.auth.verifyOtp({
      type: link.type,
      token_hash: link.tokenHash,
    });
    return error ? back("expired") : NextResponse.redirect(`${origin}${next}`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(link.code);
  if (!error) return NextResponse.redirect(`${origin}${next}`);

  /**
   * 교환은 코드 검증자(쿠키)가 **링크를 연 브라우저**에 있어야 성공한다. 폰으로 메일을
   * 열면 가입한 브라우저와 달라 실패한다. 그래도 여기까지 왔다는 것은 Supabase가 이미
   * 이메일을 확인했다는 뜻이므로("실패했으면 `error`를 달고 온다") 로그인만 남았다.
   */
  return back("signin");
}
