import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * DEVELOPMENT_PLAN.md §10 Phase 1 / CLAUDE.md §6: skipWaiting은 비활성.
 * 작성 중인 훈련 세션이 있는 상태에서 새 버전이 강제로 새로고침을 일으키면
 * 사용자 입력을 잃을 수 있다(원칙 7, 입력 유실 금지).
 *
 * 대신 새 버전이 준비되면 `features/pwa/AppUpdateBanner.tsx`가 알려주고, 새로고침은
 * 사용자가 누를 때만 한다 — 알려주지 않으면 설치형 사용자는 탭을 전부 닫기 전까지
 * 영영 옛 버전에 머물고, 버그를 고쳐도 전달되지 않는다.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
