import type { Locator, Page } from "@playwright/test";

/**
 * 앱이 띄운 오류 안내만 고르는 로케이터.
 *
 * Next.js는 라우트 변경을 스크린 리더에 알리려고
 * `<div role="alert" aria-live="assertive" id="__next-route-announcer__">`를
 * **항상 DOM에 둔다.** 내용이 비어 있어도 1×1 크기의 요소라 Playwright는 이것을
 * "보이는" 요소로 판정한다.
 *
 * 그래서 `expect(page.getByRole("alert")).toBeVisible()`은 화면에 아무 오류도 없을 때도
 * 통과한다. 실제로 원칙 8(AI 실패가 세션 실패가 되지 않는다) 회귀 테스트 3개가
 * 그 상태로 **아무것도 검증하지 않은 채** 초록불이었다(2026-09-08 발견). 하필
 * "실패했는데 화면에 아무 표시도 없다"를 막으려고 쓴 테스트들이라, 테스트 자신이
 * 같은 방식으로 침묵하고 있었던 셈이다.
 *
 * 오류 안내를 확인할 때는 `getByRole("alert")` 대신 이 함수를 쓴다.
 */
export function appAlert(page: Page): Locator {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}
