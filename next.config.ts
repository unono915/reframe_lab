import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import { missingSupabaseEnv, supabaseEnvErrorMessage } from "./src/lib/supabase/env";

/**
 * 환경변수가 없으면 빌드를 여기서 멈춘다. `NEXT_PUBLIC_*`는 빌드 시점에 인라인되므로,
 * 값 없이 빌드하면 `undefined`가 박힌 배포가 조용히 나가고 전 경로가 500으로 죽는다
 * (2026-08-16 첫 배포에서 실제로 발생). 깨진 사이트를 띄우느니 빌드가 실패하고
 * 무엇이 없는지 출력하는 편이 낫다 — 자세한 배경은 src/lib/supabase/env.ts 참고.
 */
const missing = missingSupabaseEnv();
if (missing.length > 0) {
  throw new Error(`\n\n${supabaseEnvErrorMessage(missing)}\n`);
}

/**
 * Supabase 호출 대상 origin. CSP의 `connect-src`에 정확히 이 출처만 열어준다 —
 * `https:`처럼 넓게 열면 토큰을 아무 데나 보내는 코드가 주입돼도 막지 못한다.
 * 빌드 시점에 이미 존재가 검증된 값이다(위 guard).
 */
const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;

/**
 * 모든 응답에 붙는 보안 헤더.
 *
 * `script-src`에 `'unsafe-inline'`이 남아 있다 — Next가 하이드레이션 부트스트랩을
 * 인라인 `<script>`로 넣기 때문이고, 없애려면 proxy에서 nonce를 발급해 넘겨야 한다.
 * 그 한 줄이 빠져도 나머지가 막아주는 것이 적지 않다:
 * - `frame-ancestors 'none'` — 로그인된 화면을 남의 iframe에 얹는 클릭재킹
 * - `base-uri 'self'` — `<base>` 주입으로 모든 상대 경로를 남의 서버로 돌리는 공격
 * - `form-action 'self'` — 주입된 form이 입력을 외부로 보내는 것
 * - `connect-src` — 토큰·본문을 우리 서버와 Supabase 외부로 보내는 것
 * - `object-src 'none'` — 플러그인 기반 실행
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace("https://", "wss://")}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
          // MIME 스니핑을 막는다 — 사용자가 올린 적 없는 앱이지만, 잘못된
          // Content-Type이 스크립트로 해석되는 경로를 아예 닫아둔다.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // frame-ancestors를 이해하지 못하는 구형 브라우저용 이중 방어.
          { key: "X-Frame-Options", value: "DENY" },
          // 외부로 나갈 때 경로·쿼리를 흘리지 않는다. 세션 id가 URL에 있는 화면이 있다.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 이 앱은 카메라·마이크·위치를 쓰지 않는다(PRD §19.2 MVP 제외). 아예 끈다.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

// Next.js 16은 Turbopack이 기본이므로 webpack 기반 @serwist/next 대신
// @serwist/turbopack(configurator mode)을 사용한다. 실제 SW 번들은
// src/app/serwist/[path]/route.ts가 요청 시점에 만든다.
export default withSerwist(nextConfig);
