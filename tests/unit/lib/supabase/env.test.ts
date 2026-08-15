import { describe, expect, it } from "vitest";
import {
  missingSupabaseEnv,
  REQUIRED_SUPABASE_ENV,
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
