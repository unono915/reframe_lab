import { createSerwistRoute } from "@serwist/turbopack";
import { spawnSync } from "node:child_process";

// 커밋 해시를 revision으로 써서, 아래 문서들이 새 배포마다 다시 캐시되게 한다.
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout.trim() ||
  crypto.randomUUID();

/**
 * PRD §13.3 P0: "앱 Shell과 기본 화면 실행"은 오프라인이다. Next.js 빌드 매니페스트는
 * _next/static 자산만 자동 정적 캐시하고 HTML 문서는 넣지 않으므로, 첫 방문이 오프라인이어도
 * 열리게 하려는 화면은 여기에 명시적으로 추가한다. Phase 2~3에서 동적 데이터가 붙는 화면은
 * 이 정적 프리캐시 대신 Runtime Cache·IndexedDB 초안으로 다룬다.
 */
const appShellRoutes = ["/", "/onboarding", "/offline"];

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    additionalPrecacheEntries: appShellRoutes.map((url) => ({ url, revision })),
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
  });
