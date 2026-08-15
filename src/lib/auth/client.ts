import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * `features/`가 Supabase SDK를 직접 만지지 않도록 하는 얇은 Adapter (eslint.config.mjs
 * 레이어 규칙 — repositories/ai와 동일 원칙을 인증에도 적용). 모든 함수는
 * `{ok:true,...} | {ok:false, message}` 판별 유니언을 반환한다 — throw로 UI를
 * 놀라게 하지 않고, DESIGN.md §10.9의 공통 오류 문구를 여기서 한 곳에 모은다.
 */

export type AuthResult = { ok: true } | { ok: false; message: string };

const GENERIC_LOGIN_ERROR = "이메일 또는 비밀번호를 다시 확인해주세요.";
const GENERIC_ERROR = "잠시 후 다시 시도해주세요.";

function emailRedirectTo(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // 계정 열거 공격 방지 — 자격 증명 오류든 미인증 이메일이든 같은 문구를 보인다.
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }
  return { ok: true };
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: emailRedirectTo("/auth/confirm?next=/") },
  });
  if (error) {
    if (error.code === "user_already_exists" || error.status === 422) {
      return { ok: false, message: "이미 가입된 이메일이에요. 로그인해주세요." };
    }
    return { ok: false, message: GENERIC_ERROR };
  }
  return { ok: true };
}

export async function hasActiveSession(): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session !== null;
}

export async function signOut(): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.signOut();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  // 계정 존재 여부를 노출하지 않기 위해 결과를 분기하지 않는다 (DESIGN.md §10.9.3).
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: emailRedirectTo("/auth/reset-password/confirm"),
  });
}

export async function updatePassword(newPassword: string): Promise<AuthResult> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, message: GENERIC_ERROR };
  return { ok: true };
}

export async function resendVerificationEmail(email: string): Promise<AuthResult> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: emailRedirectTo("/auth/confirm?next=/") },
  });
  if (error) return { ok: false, message: GENERIC_ERROR };
  return { ok: true };
}
