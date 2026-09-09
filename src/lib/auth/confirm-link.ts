import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * 이메일 인증 링크가 어떤 모양으로 도착했는지 판정한다.
 *
 * 순수 함수로 떼어 둔 이유: 이 판정이 틀리면 **인증이 실제로 끝난 순간에 "만료됐다"고
 * 말하게 된다.** 화면에는 아무 오류도 없고(로그인 페이지가 정상적으로 뜬다) 서버 로그도
 * 조용하다 — 사용자만 계속 링크를 다시 받는다. 이런 종류는 테스트로 못 박아 두지 않으면
 * 다음에 또 조용히 깨진다.
 *
 * 링크는 두 모양으로 온다:
 * - `token_hash`+`type` — 메일 템플릿에 `{{ .TokenHash }}`를 직접 쓴 경우. 다른 기기에서
 *   열어도 되므로 이쪽이 낫다.
 * - `code` — Supabase **기본** 템플릿(`{{ .ConfirmationURL }}`). Supabase가 자기
 *   `/auth/v1/verify`에서 이메일 확인을 **먼저 끝낸 뒤** 이 앱으로 넘긴다. 그래서
 *   `token_hash`는 없고 PKCE `code`만 붙어 온다.
 */
export type ConfirmLink =
  | { kind: "otp"; tokenHash: string; type: EmailOtpType }
  | { kind: "code"; code: string }
  | { kind: "failed" };

export function readConfirmLink(params: URLSearchParams): ConfirmLink {
  // Supabase가 확인을 거부하면 오류를 쿼리로 되돌려준다(만료·이미 사용 등).
  // 이 경우 `code`가 함께 올 수도 있으므로 **오류를 먼저** 본다.
  if (params.get("error_code") ?? params.get("error")) return { kind: "failed" };

  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  if (tokenHash && type) {
    return { kind: "otp", tokenHash, type: type as EmailOtpType };
  }

  const code = params.get("code");
  if (code) return { kind: "code", code };

  return { kind: "failed" };
}
