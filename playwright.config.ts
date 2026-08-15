import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { STORAGE_STATE_PATH } from "./tests/e2e/global-setup";

// Next.js는 .env.local을 자동으로 읽지만, Playwright는 별도 Node 프로세스라 직접
// 읽어야 한다 — 안 그러면 E2E_TEST_EMAIL/PASSWORD가 항상 undefined로 보여 로그인
// 필요한 테스트가 항상 skip된다.
loadEnv({ path: ".env.local" });

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const hasE2ELogin = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // 로그인 필요한 테스트들이 계정 하나를 공유한다("1 사용자당 활성 세션 1개" 제약) —
  // 병렬로 돌리면 서로의 세션을 지우거나 겹쳐 쓴다. worker 1개로 강제 직렬화한다.
  workers: process.env.CI || hasE2ELogin ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  // Phase 3: 로그인이 필요한 Flow는 global-setup에서 한 번 로그인해 저장한
  // storageState를 재사용한다. E2E_TEST_EMAIL/PASSWORD가 없으면 setup은 아무것도
  // 하지 않고, 로그인 의존 테스트는 각 spec에서 스스로 skip한다(.env.example 참고).
  globalSetup: hasE2ELogin ? "./tests/e2e/global-setup" : undefined,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    ...(hasE2ELogin ? { storageState: STORAGE_STATE_PATH } : {}),
  },
  // Phase 3부터 각 단계 전환이 실제 Supabase 네트워크 왕복을 거친다(더 이상 즉시
  // 반영되는 IndexedDB가 아니다) — 여러 mutate가 연달아 큐잉된 뒤 advance까지 가면
  // 기본 5000ms를 넘기는 경우가 있어 넉넉히 늘렸다.
  expect: { timeout: 10_000 },
  projects: [
    {
      name: "iPhone 14 (iOS Safari)",
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "Desktop Chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // 프로덕션 빌드로 띄운다 — dev 모드는 라우트별 온디맨드 컴파일과 Fast Refresh
    // 때문에 자동화 클릭 타이밍이 흔들릴 수 있다(로컬에서 실제로 겪음: 여러 번의
    // Fast Refresh 뒤 컴포넌트 클로저가 갱신되지 않는 것처럼 보이는 현상 재현).
    command: `npx next build && npx next start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
