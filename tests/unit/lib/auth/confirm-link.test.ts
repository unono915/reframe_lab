import { describe, expect, it } from "vitest";
import { readConfirmLink } from "@/lib/auth/confirm-link";

const read = (query: string) =>
  readConfirmLink(new URL(`https://app.test/auth/confirm${query}`).searchParams);

describe("readConfirmLink", () => {
  it("메일 템플릿이 token_hash를 직접 넘긴 링크를 알아본다", () => {
    expect(read("?token_hash=abc123&type=email&next=/")).toEqual({
      kind: "otp",
      tokenHash: "abc123",
      type: "email",
    });
  });

  /**
   * 이 한 줄이 2026-09-09의 결함이다. Supabase **기본** 템플릿은 자기 `/auth/v1/verify`
   * 에서 이메일 확인을 끝낸 뒤 이 주소로 넘기므로 `token_hash` 없이 `code`만 온다.
   * 이것을 실패로 보면 인증이 끝난 사람에게 "만료됐다"고 말하게 된다.
   */
  it("Supabase 기본 템플릿이 넘기는 code 링크를 실패로 보지 않는다", () => {
    expect(read("?next=%2F&code=pkce-code-value")).toEqual({
      kind: "code",
      code: "pkce-code-value",
    });
  });

  it("Supabase가 오류를 되돌려주면 code가 함께 와도 실패로 본다", () => {
    // 만료된 링크는 `code` 없이 오지만, 순서가 뒤집히면 오류를 성공으로 읽게 된다.
    expect(read("?error=access_denied&error_code=otp_expired&code=stale")).toEqual({
      kind: "failed",
    });
    expect(read("?error_code=otp_expired")).toEqual({ kind: "failed" });
  });

  it("token_hash만 있고 type이 없으면 교환할 수 없으므로 실패로 본다", () => {
    expect(read("?token_hash=abc123")).toEqual({ kind: "failed" });
    expect(read("?type=email")).toEqual({ kind: "failed" });
  });

  it("아무 표식도 없는 요청은 실패로 본다", () => {
    expect(read("")).toEqual({ kind: "failed" });
    expect(read("?next=%2Fhistory")).toEqual({ kind: "failed" });
  });
});
