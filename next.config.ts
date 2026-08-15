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

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

// Next.js 16은 Turbopack이 기본이므로 webpack 기반 @serwist/next 대신
// @serwist/turbopack(configurator mode)을 사용한다. 실제 SW 번들은
// src/app/serwist/[path]/route.ts가 요청 시점에 만든다.
export default withSerwist(nextConfig);
