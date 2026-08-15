import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 서버(Route Handler·Server Component)용 Supabase 클라이언트. 요청의 쿠키에서
 * 사용자 세션을 읽는다 — Service Role Key를 쓰지 않는다. 모든 쓰기·읽기는
 * 이 클라이언트가 들고 있는 사용자 세션 기준으로 RLS를 통과해야 한다
 * (`user_id = auth.uid()`). 클라이언트가 보낸 userId는 절대 신뢰하지 않는다
 * (DEVELOPMENT_PLAN.md §6.3 원칙 6).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component에서 호출되면 쓰기가 불가능하다 — middleware가
            // 세션 갱신을 담당하므로 여기서는 무시해도 안전하다.
          }
        },
      },
    },
  );
}
