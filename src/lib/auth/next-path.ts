/**
 * 로그인·이메일 확인 뒤에 돌아갈 자리(`?next=`)를 검증한다.
 *
 * 이 값은 URL에서 오고, URL은 누구나 만들 수 있다. 검증 없이 `router.push(next)`나
 * `redirect(origin + next)`에 넘기면 열린 리다이렉트(CWE-601)가 된다 —
 * `https://다시봄/auth/login?next=https://가짜다시봄` 같은 링크를 받은 사람은 **진짜
 * 도메인에서 진짜 로그인 폼에 진짜 비밀번호를 넣은 뒤** 남의 사이트로 넘어간다.
 * 그 사이트가 같은 화면을 흉내 내면 "세션이 만료됐어요"라며 비밀번호를 한 번 더
 * 받아낼 수 있다. 도메인을 확인하는 습관이 오히려 피해자를 안심시키는 구조다.
 *
 * 그래서 **이 앱 안의 경로만** 허용한다. 판단 기준은 하나다: `/`로 시작하는 경로이되,
 * 인증부(authority)를 새로 여는 모양이면 안 된다.
 *   - `//evil.com`, `/\evil.com` — 프로토콜 상대 URL. 브라우저는 `\`를 `/`로 고쳐
 *     읽으므로 둘 다 같은 뜻이 된다.
 *   - `https://evil.com`, `javascript:...` — 스킴이 있는 절대 URL.
 *   - 제어 문자가 섞인 값 — 파서마다 다르게 읽히는 자리라 아예 받지 않는다.
 *
 * 통과하지 못하면 조용히 홈으로 보낸다. 공격이 아니라 오래된 링크일 수도 있고,
 * 어느 쪽이든 사용자가 할 수 있는 일은 없기 때문이다.
 */
export const DEFAULT_NEXT_PATH = "/";

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_NEXT_PATH;
  if (!raw.startsWith("/")) return DEFAULT_NEXT_PATH;
  // 두 번째 글자가 `/`나 `\`면 인증부가 열린다 — 이 앱 밖으로 나가는 모양이다.
  if (raw.length > 1 && (raw[1] === "/" || raw[1] === "\\")) return DEFAULT_NEXT_PATH;
  // 제어 문자(줄바꿈 포함)는 파서마다 다르게 읽히는 자리라 아예 받지 않는다.
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return DEFAULT_NEXT_PATH;
  }
  return raw;
}
