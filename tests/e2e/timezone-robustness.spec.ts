import { expect, test } from "@playwright/test";

/**
 * 시간대 값이 이상해도 화면이 죽지 않는지 확인한다.
 *
 * 이 값은 브라우저가 `Intl.DateTimeFormat().resolvedOptions().timeZone`으로 알려준
 * 것을 그대로 쿼리에 실어 서버까지 들고 온 것이다. 그런데 `Intl`은 모르는 시간대를
 * 받으면 `RangeError`를 던지고, 그걸 그대로 두면 **홈·성장·오늘의 렌즈가 한꺼번에
 * 500으로 죽는다.** 화면에는 "잠시 문제가 생겼어요"만 뜨고, 사용자는 원인이 자기
 * 브라우저의 시간대 설정이라는 것을 알 방법이 없다 — 스스로 고칠 수도 없다.
 *
 * 이상한 값이 오는 경로는 실제로 있다: 지문 방지 설정이 켜진 브라우저, 오래된
 * 런타임, 그리고 주소창에서 쿼리를 고친 사람. 날짜가 하루 어긋나더라도 앱은 계속
 * 쓸 수 있어야 한다는 것이 여기서 잠그는 규칙이다.
 */
test.skip(
  !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
  "E2E_TEST_EMAIL/PASSWORD 미설정 — 로그인 필요한 E2E는 건너뜀 (.env.example 참고)",
);

const TIMEZONE_PARAMS = [
  "Asia/Seoul", // 정상
  "Not/AZone", // IANA 이름 모양이지만 존재하지 않는다
  "", // 빈 값
  "UTC+9", // 흔한 오해 — 오프셋 표기는 IANA 이름이 아니다
  "12345",
  "'; drop--",
];

const ENDPOINTS = ["/api/home", "/api/growth", "/api/templates/today"];

for (const timezone of TIMEZONE_PARAMS) {
  test(`시간대가 "${timezone}"이어도 화면에 필요한 것을 준다`, async ({ request }) => {
    for (const path of ENDPOINTS) {
      const response = await request.get(
        `${path}?timezone=${encodeURIComponent(timezone)}`,
      );
      expect(response.status(), `${path} (timezone=${timezone})`).toBe(200);
      // 200이지만 본문이 깨져 있으면 화면은 여전히 오류로 끝난다.
      await expect(response.json()).resolves.toBeTruthy();
    }
  });
}
