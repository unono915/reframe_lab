import { createBrowserClient } from "@supabase/ssr";

/**
 * 브라우저(Client Component)용 Supabase 클라이언트. anon key만 사용 — RLS가
 * 실제 접근 제어를 담당한다. 이 파일은 `lib/repositories/supabase/`와 `lib/auth/`
 * 내부에서만 쓰고, `features/`·`components/`가 직접 import하지 않는다
 * (eslint.config.mjs 레이어 규칙).
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
