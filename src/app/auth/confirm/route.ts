import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Supabase Auth 이메일 Link(가입 확인·비밀번호 재설정)가 최종적으로 도착하는 곳.
 * `token_hash`+`type`을 세션으로 교환한 뒤 원래 목적지로 보낸다 — 이 교환이 실패하면
 * 링크가 만료됐거나 이미 쓰인 것이므로 로그인 화면에서 다시 시도하게 한다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?verify_error=1`);
}
