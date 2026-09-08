import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/next-path";

/**
 * 열린 리다이렉트(CWE-601) 회귀 테스트.
 *
 * 로그인 뒤 돌아갈 자리는 URL에서 오고, URL은 누구나 만들 수 있다. 검증 없이
 * `router.push(next)`에 넘기면 `?next=https://가짜다시봄` 같은 링크를 받은 사람이
 * **진짜 도메인에서 진짜 비밀번호를 넣은 직후** 남의 사이트로 넘어간다. 도메인을
 * 확인하는 습관이 오히려 피해자를 안심시키는 구조라 특히 나쁘다.
 */
describe("safeNextPath", () => {
  it("이 앱 안의 경로는 그대로 돌려준다", () => {
    expect(safeNextPath("/history")).toBe("/history");
    expect(safeNextPath("/result/abc-123")).toBe("/result/abc-123");
    expect(safeNextPath("/training/new?solo=1")).toBe("/training/new?solo=1");
    expect(safeNextPath("/growth#trend")).toBe("/growth#trend");
  });

  it("없거나 비어 있으면 홈으로 보낸다", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("/")).toBe("/");
  });

  it("다른 사이트로 나가는 값은 받지 않는다", () => {
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("http://evil.example")).toBe("/");
    // 스킴 없이 인증부만 여는 형태. 브라우저는 이것도 다른 사이트로 읽는다.
    expect(safeNextPath("//evil.example")).toBe("/");
    // 브라우저는 URL 안의 `\`를 `/`로 고쳐 읽으므로 위와 같은 뜻이 된다.
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("\\\\evil.example")).toBe("/");
  });

  it("경로가 아닌 값은 받지 않는다", () => {
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath("data:text/html,<script>alert(1)</script>")).toBe("/");
    expect(safeNextPath("history")).toBe("/");
  });

  it("제어 문자가 섞인 값은 받지 않는다", () => {
    // 줄바꿈은 파서마다 다르게 읽히는 자리라 통째로 거른다.
    expect(safeNextPath("/history\nSet-Cookie: a=b")).toBe("/");
    expect(safeNextPath("/history\r\n")).toBe("/");
    expect(safeNextPath(`/history${String.fromCharCode(0)}`)).toBe("/");
    expect(safeNextPath(`/history${String.fromCharCode(127)}`)).toBe("/");
  });
});
