import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

// Next.js 16은 Turbopack이 기본이므로 webpack 기반 @serwist/next 대신
// @serwist/turbopack(configurator mode)을 사용한다. 실제 SW 번들은
// src/app/serwist/[path]/route.ts가 요청 시점에 만든다.
export default withSerwist(nextConfig);
