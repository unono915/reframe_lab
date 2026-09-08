import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  missingSupabaseEnv,
  REQUIRED_SUPABASE_ENV,
  requireSupabaseEnv,
  supabaseEnvErrorMessage,
} from "@/lib/supabase/env";

/**
 * 2026-08-16 첫 배포가 전 경로 500으로 죽은 원인의 회귀 테스트. 환경변수 없이
 * 빌드가 조용히 성공해 `undefined`가 인라인된 배포가 나갔고, 미들웨어가 매 요청마다
 * 죽었다. 사용자에게는 스타일 없는 "Internal Server Error" 한 줄만 보였다.
 */
describe("missingSupabaseEnv", () => {
  const full = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  };

  it("모든 값이 있으면 빈 배열", () => {
    expect(missingSupabaseEnv(full)).toEqual([]);
  });

  it("값이 아예 없으면 필요한 이름을 전부 돌려준다", () => {
    expect(missingSupabaseEnv({})).toEqual([...REQUIRED_SUPABASE_ENV]);
  });

  it("빈 문자열은 누락으로 본다 — 대시보드에서 빈 값을 저장한 경우", () => {
    expect(missingSupabaseEnv({ ...full, NEXT_PUBLIC_SUPABASE_ANON_KEY: "" })).toEqual([
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]);
  });

  it("공백뿐인 값도 누락으로 본다", () => {
    expect(missingSupabaseEnv({ ...full, NEXT_PUBLIC_SUPABASE_URL: "   " })).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL",
    ]);
  });
});

describe("supabaseEnvErrorMessage", () => {
  it("빠진 변수 이름을 그대로 알려준다", () => {
    const message = supabaseEnvErrorMessage(["NEXT_PUBLIC_SUPABASE_URL"]);
    expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("값만 추가하고 재배포하지 않으면 안 된다는 점을 알려준다", () => {
    // 이번 장애에서 가장 헷갈렸던 지점이라 메시지에 반드시 남아 있어야 한다.
    const message = supabaseEnvErrorMessage([...REQUIRED_SUPABASE_ENV]);
    expect(message).toContain("재배포");
    expect(message).toContain("docs/deployment.md");
  });
});

describe("requireSupabaseEnv", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("값이 다 있으면 그대로 돌려준다", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(requireSupabaseEnv()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    });
  });

  it("없으면 **무엇이** 없는지 말하는 오류를 던진다", () => {
    // `process.env.X!` 같은 non-null 단언은 런타임에 아무것도 막지 못한다 —
    // 실제로 그 단언 때문에 undefined가 Supabase SDK까지 흘러들어가 죽었고,
    // 사용자는 스타일도 없는 "Internal Server Error" 한 줄만 봤다.
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    expect(() => requireSupabaseEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("오류 문구가 '다시 빌드해야 한다'는 것을 알려준다", () => {
    // 이 한 줄이 없어서 실제로 시간을 잃었다. 값을 대시보드에 넣어도 재빌드 전까지는
    // 기존 배포가 계속 같은 오류로 죽는데, 그 사실을 아무 데서도 알려주지 않았다.
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
    expect(() => requireSupabaseEnv()).toThrowError(/다시 빌드/);
  });
});

describe("env.ts는 NEXT_PUBLIC_* 를 리터럴로 읽는다", () => {
  /**
   * 이건 소스 자체를 보는 검사다. 다른 방법이 없다 — **Node에서는 동적 접근도
   * 멀쩡히 동작하기 때문에** 실행만으로는 절대 드러나지 않는다.
   *
   * Next.js는 `process.env.NEXT_PUBLIC_X`라는 **리터럴 표현**만 빌드 시점에 실제
   * 값으로 치환한다. `process.env[name]`처럼 계산된 키로 읽으면 번들러가 치환하지
   * 못해 브라우저에서는 항상 undefined가 된다. 실제로 이 파일이 배열을 순회하며
   * 동적으로 읽던 시기가 있었고, 그동안 **브라우저 로그인이 매번 막혀 있었다**
   * (2026-08-26 발견). 서버 테스트는 전부 통과하고 있었다.
   */
  it("계산된 키로 process.env를 읽지 않는다", () => {
    const source = readFileSync("src/lib/supabase/env.ts", "utf-8");
    // 주석 안의 예시 표현이 검사에 걸리지 않도록 주석을 먼저 걷어낸다.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(new RegExp("//.*", "g"), "");

    expect(code).not.toMatch(/process\.env\s*\[/);
    for (const name of REQUIRED_SUPABASE_ENV) {
      expect(code).toContain(`process.env.${name}`);
    }
  });
});
