/**
 * Supabase 연결에 반드시 필요한 환경변수의 단일 검증 지점.
 *
 * 왜 필요한가 — 2026-08-16 첫 배포가 전 경로 500(Internal Server Error)으로 죽었다.
 * 원인은 Vercel에 환경변수를 넣기 전에 빌드가 돌아간 것이었는데, 문제는 **그 빌드가
 * 아무 경고 없이 성공했다**는 점이다. Next.js는 `NEXT_PUBLIC_*`를 빌드 시점에
 * 코드로 인라인하므로, 값이 없으면 `undefined`가 그대로 박힌 채 배포가 나간다.
 * 그 뒤 대시보드에 값을 넣어도 재빌드 전까지는 아무 것도 바뀌지 않는다.
 *
 * 사용자가 본 것은 스타일도 없는 "Internal Server Error" 한 줄뿐이었다 —
 * 미들웨어(proxy.ts)가 매 요청마다 `createServerClient(undefined, undefined)`를
 * 호출하다 죽었기 때문이다. 무엇이 잘못됐는지 알 방법이 없었다.
 *
 * 그래서 두 곳에서 막는다.
 * 1. **빌드 시점** (`next.config.ts`) — 값이 없으면 빌드를 실패시킨다. 깨진 사이트를
 *    배포하느니 빌드가 실패하고 이유를 출력하는 편이 낫다.
 * 2. **실행 시점** (아래 `requireSupabaseEnv`) — 그래도 새어나갔을 때 원인을 말해주는
 *    오류를 던진다.
 */

export const REQUIRED_SUPABASE_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

type Env = Record<string, string | undefined>;

/** 비어 있거나 공백뿐인 값도 누락으로 본다 — 대시보드에서 실수로 빈 값을 넣는 경우. */
export function missingSupabaseEnv(env: Env = process.env): string[] {
  return REQUIRED_SUPABASE_ENV.filter((name) => !env[name]?.trim());
}

export function supabaseEnvErrorMessage(missing: string[]): string {
  return [
    `Supabase 환경변수가 없습니다: ${missing.join(", ")}`,
    "",
    "이 값들은 빌드 시점에 코드로 인라인되므로, 배포 환경(Vercel Project Settings →",
    "Environment Variables)에 먼저 넣은 뒤 다시 빌드해야 반영됩니다. 값만 추가하고",
    "재배포하지 않으면 기존 배포는 계속 같은 오류로 죽습니다.",
    "",
    "로컬이라면 .env.example을 복사해 .env.local을 만들고 값을 채우세요.",
    "자세한 절차: docs/deployment.md",
  ].join("\n");
}

/**
 * 값이 모두 있으면 반환하고, 하나라도 없으면 원인을 말해주는 오류를 던진다.
 * `process.env.X!`처럼 non-null 단언으로 넘기면 런타임에는 아무 보호가 없다 —
 * 실제로 그 단언 때문에 undefined가 Supabase SDK까지 흘러들어가 죽었다.
 */
export function requireSupabaseEnv(): { url: string; anonKey: string } {
  const missing = missingSupabaseEnv();
  if (missing.length > 0) {
    throw new Error(supabaseEnvErrorMessage(missing));
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  };
}
