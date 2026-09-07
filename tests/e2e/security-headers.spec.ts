import { expect, test } from "@playwright/test";

/**
 * 보안 응답 헤더의 회귀 테스트.
 *
 * 이런 헤더는 **없어져도 아무것도 깨지지 않는다.** 화면은 그대로 뜨고 테스트도
 * 통과하니, 설정을 정리하다 한 줄이 사라져도 알아챌 방법이 없다. 그래서 값을
 * 여기에 못 박아 둔다.
 *
 * 로그인이 필요 없는 경로만 쓴다 — 자격증명 시크릿이 없는 CI에서도 이 검사는
 * 돌아야 한다(다른 E2E는 전부 건너뛰는 상황에서도).
 */
const EXPECTED = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  // preload는 일부러 넣지 않는다 — 되돌리기 어려운 등록이라 사용자가 결정할 일이다.
  "strict-transport-security": "max-age=63072000; includeSubDomains",
} as const;

/** CSP에서 이것들이 빠지면 막고 있던 공격이 다시 열린다. */
const REQUIRED_CSP_DIRECTIVES = [
  // 로그인된 화면을 남의 iframe에 얹는 클릭재킹
  "frame-ancestors 'none'",
  // <base> 주입으로 모든 상대 경로를 남의 서버로 돌리는 공격
  "base-uri 'self'",
  // 주입된 form이 입력을 외부로 보내는 것
  "form-action 'self'",
  // 플러그인 기반 실행
  "object-src 'none'",
  "default-src 'self'",
];

for (const path of ["/auth/login", "/api/templates"]) {
  test(`보안 헤더가 붙는다: ${path}`, async ({ request }) => {
    const response = await request.get(path);
    const headers = response.headers();

    for (const [key, value] of Object.entries(EXPECTED)) {
      expect(headers[key], `${path} 의 ${key}`).toBe(value);
    }

    const csp = headers["content-security-policy"] ?? "";
    expect(csp, `${path} 에 CSP가 없다`).toBeTruthy();
    for (const directive of REQUIRED_CSP_DIRECTIVES) {
      expect(csp).toContain(directive);
    }

    // connect-src는 우리 서버와 Supabase만 열어야 한다. `https:`처럼 넓게 열면
    // 토큰을 아무 데나 보내는 코드가 주입돼도 막지 못한다 — 그 자리를 지킨다.
    const connectSrc = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("connect-src"));
    expect(connectSrc, "connect-src 지시자가 없다").toBeTruthy();
    expect(connectSrc).not.toMatch(/(^|\s)(\*|https:|http:)(\s|$)/);
    expect(connectSrc).toContain(".supabase.co");

    // 카메라·마이크·위치는 이 앱이 쓰지 않는다(PRD §19.2 MVP 제외).
    const permissions = headers["permissions-policy"] ?? "";
    for (const feature of ["camera=()", "microphone=()", "geolocation=()"]) {
      expect(permissions).toContain(feature);
    }
  });
}
