import { chromium, type FullConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Phase 3부터 훈련 Flow는 로그인 필수다. 매 테스트가 로그인 폼을 다시 거치면
 * 느리고 취약하므로, 한 번만 로그인해 storageState(쿠키)를 파일로 저장하고
 * 모든 프로젝트가 그것을 재사용한다(playwright.config.ts). `E2E_TEST_EMAIL`/
 * `E2E_TEST_PASSWORD`가 없으면 로그인 없이 종료 — 의존하는 테스트는 각자 skip한다.
 */
export const STORAGE_STATE_PATH = path.join(dirname, ".auth", "e2e-user.json");

export default async function globalSetup(config: FullConfig) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) return;

  const baseURL = config.projects[0]?.use.baseURL;
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });

  await page.goto("/auth/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/"));

  await page.context().storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}
