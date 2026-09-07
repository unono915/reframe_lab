"use client";

import { AppUpdateBanner } from "./AppUpdateBanner";
import { OfflineBanner } from "./OfflineBanner";

/**
 * 상태 배너(오프라인·새 버전)를 화면 위쪽에 쌓는다.
 *
 * **하단 고정이 아니다.** 처음에는 하단에 띄웠는데, 훈련 화면의 주 버튼("다음
 * 질문으로")도 하단에 있어서 배너가 그 버튼을 덮었다 — 오프라인일 때만 앱이 잠기는
 * 셈이었다. `toBeVisible`로는 보이지 않는 종류의 결함이라 E2E에서
 * `click({ trial: true })`로 잡았다(`offline-banner.spec.ts`).
 *
 * 그래서 문서 흐름 안에 두고 `sticky`로 위에 붙인다. 배너가 뜨면 화면이 그만큼
 * 아래로 밀릴 뿐 아무것도 가리지 않는다. 배너가 없을 때는 자식이 모두 null이라
 * 높이가 0이다 — 세로 padding을 컨테이너에 주지 않는 이유가 그것이다.
 *
 * `pointer-events-none`을 두고 각 배너가 스스로 `pointer-events-auto`를 켜는 이유는,
 * 배너 좌우의 빈 영역이 아래 화면의 클릭을 가로막지 않게 하기 위해서다.
 */
export function AppBanners() {
  return (
    <div className="pt-safe pointer-events-none sticky top-0 z-50 flex flex-col gap-2 px-5">
      <OfflineBanner />
      <AppUpdateBanner />
    </div>
  );
}
