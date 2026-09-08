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
import { reportNetworkFailure, reportNetworkSuccess } from "@/lib/network-status";
import { clearCachedResponses } from "@/lib/persistence/clear-cached-responses";

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
const NETWORK_ERROR = "지금 서버에 닿지 못했어요. 연결을 확인한 뒤 다시 시도해주세요.";

/**
 * 서버가 대답한 실패인가, 서버에 닿지도 못한 실패인가.
 *
 * 둘을 뭉뚱그리면 문구가 사용자를 잘못된 곳으로 보낸다 — 지하철에서 연결이 끊긴
 * 사람에게 "이메일 또는 비밀번호를 다시 확인해주세요"라고 말하면, 맞는 비밀번호를
 * 몇 번이고 다시 입력하다가 자기 계정을 의심하게 된다. 앱의 다른 저장 경로는 이미
 * 이 구분을 하고 있는데(`lib/network-status.ts`) 인증 화면만 빠져 있었다.
 *
 * supabase-js는 fetch 자체가 실패하면 `AuthRetryableFetchError`(상태 0)를 준다.
 * 클래스를 import하지 않고 이름으로 보는 이유는 그 클래스가 전이 의존성
 * (`@supabase/auth-js`)에만 있어서다 — 직접 import하면 우리가 고르지 않은 패키지의
 * 경로에 묶인다.
 *
 * **계정 열거와는 무관한 구분이다.** 여기서 갈리는 것은 전송 계층의 성패뿐이고,
 * 서버가 대답한 경우의 문구는 예전과 똑같이 하나로 유지된다.
 */
function isTransportFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, status } = error as { name?: string; status?: number };
  return name === "AuthRetryableFetchError" || status === 0;
}

/**
 * 인증 호출의 결과를 네트워크 상태에 반영한다. 오프라인 배너는 관측된 실패로
 * 판단하는데(`navigator.onLine`은 캡티브 포털에서 거짓말을 한다), 인증 화면만
 * `trackedFetch`를 거치지 않아 이 관측에서 빠져 있었다 — 로그인이 안 되는 진짜 이유가
 * 화면 어디에도 없던 셈이다.
 */
function reportAuthOutcome(error: unknown): boolean {
  const transport = isTransportFailure(error);
  if (transport) reportNetworkFailure();
  else reportNetworkSuccess();
  return transport;
}

function emailRedirectTo(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  const supabase = await browserClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (reportAuthOutcome(error)) return { ok: false, message: NETWORK_ERROR };
  if (error) {
    // 계정 열거 공격 방지 — 자격 증명 오류든 미인증 이메일이든 같은 문구를 보인다.
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }
  return { ok: true };
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  const supabase = await browserClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: emailRedirectTo("/auth/confirm?next=/") },
  });
  if (reportAuthOutcome(error)) return { ok: false, message: NETWORK_ERROR };
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

/**
 * 실패를 삼키지 않는다. 예전에는 반환값이 없어서, 로그아웃 요청이 네트워크에서
 * 죽으면 화면은 아무 말 없이 그대로 있고 사용자는 버튼이 고장 난 줄 알았다.
 */
export async function signOut(): Promise<AuthResult> {
  const supabase = await browserClient();
  const { error } = await supabase.auth.signOut();
  if (reportAuthOutcome(error)) return { ok: false, message: NETWORK_ERROR };
  if (error) return { ok: false, message: GENERIC_ERROR };
  // 세션만 지우면 Service Worker가 들고 있는 응답 캐시에 그 사람이 쓴 글이 그대로
  // 남는다(자세한 이유는 아래 함수 주석). 로그아웃이 성공한 뒤에만 지운다.
  await clearCachedResponses();
  return { ok: true };
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const supabase = await browserClient();
  // 계정 존재 여부를 노출하지 않기 위해 **서버가 대답한** 결과는 분기하지 않는다
  // (DESIGN.md §10.9.3). 다만 요청이 서버에 닿지도 못한 경우까지 "보냈어요"라고
  // 말하면 오지 않을 메일을 기다리게 된다 — 그건 보호가 아니라 거짓말이다.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: emailRedirectTo("/auth/reset-password/confirm"),
  });
  if (reportAuthOutcome(error)) return { ok: false, message: NETWORK_ERROR };
  return { ok: true };
}

export async function updatePassword(newPassword: string): Promise<AuthResult> {
  const supabase = await browserClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (reportAuthOutcome(error)) return { ok: false, message: NETWORK_ERROR };
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
  if (reportAuthOutcome(error)) return { ok: false, message: NETWORK_ERROR };
  if (error) return { ok: false, message: GENERIC_ERROR };
  return { ok: true };
}
