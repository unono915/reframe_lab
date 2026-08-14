import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
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
