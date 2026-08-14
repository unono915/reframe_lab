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
 * 사용자 입력을 잃을 수 있다(원칙 7, 입력 유실 금지). 업데이트 안내 UI는 Phase 6에서 구현한다.
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
