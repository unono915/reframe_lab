/**
 * Supabase SDK는 **동적으로** 불러온다.
 *
 * 정적 import였을 때, 이 파일을 쓰는 화면은 전부 SDK 전체를 초기 번들에 안고
 * 시작했다. Home이 특히 나빴다 — 로그아웃 버튼 하나 때문에 매일 여는 화면이
 * 인증 SDK를 통째로 받았다. 이 파일의 어떤 함수도 import 시점에는 SDK가 필요
 * 없다. 실제로 로그인·로그아웃을 눌렀을 때만 받으면 된다.
 *
 * 대신 인증 화면은 마운트 시 `prefetchAuthClient()`로 미리 받아둔다 — 사용자가
 * 이메일을 입력하는 동안 내려받히므로 제출 시점에는 이미 준비돼 있다.
 */
async function browserClient() {
  const mod = await import("@/lib/supabase/client");
  return mod.createSupabaseBrowserClient();
}

/**
 * 인증 화면이 마운트될 때 호출해 SDK 청크를 미리 받아둔다. 실패해도 조용히
 * 넘어간다 — 어차피 실제 동작 시점에 다시 시도하고, 그때는 오류를 사용자에게 알린다.
 */
export function prefetchAuthClient(): void {
  void import("@/lib/supabase/client").catch(() => undefined);
}

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
  const supabase = await browserClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // 계정 열거 공격 방지 — 자격 증명 오류든 미인증 이메일이든 같은 문구를 보인다.
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }
  return { ok: true };
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const supabase = await browserClient();
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
  const supabase = await browserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session !== null;
}

export async function signOut(): Promise<void> {
  const supabase = await browserClient();
  await supabase.auth.signOut();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = await browserClient();
  // 계정 존재 여부를 노출하지 않기 위해 결과를 분기하지 않는다 (DESIGN.md §10.9.3).
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: emailRedirectTo("/auth/reset-password/confirm"),
  });
}

export async function updatePassword(newPassword: string): Promise<AuthResult> {
  const supabase = await browserClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, message: GENERIC_ERROR };
  return { ok: true };
}

export async function resendVerificationEmail(email: string): Promise<AuthResult> {
  const supabase = await browserClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: emailRedirectTo("/auth/confirm?next=/") },
  });
  if (error) return { ok: false, message: GENERIC_ERROR };
  return { ok: true };
}
