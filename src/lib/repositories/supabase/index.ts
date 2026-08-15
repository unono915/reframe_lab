import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseSessionRepository } from "./session-repository";
import { createSupabaseTemplateRepository } from "./template-repository";

/**
 * `memory/index.ts`와 달리 모듈 싱글턴이 아니다 — 서버 Supabase 클라이언트는 요청의
 * 쿠키(사용자 세션)를 담고 있어 요청마다 새로 만들어야 한다. Route Handler가
 * `createSupabaseServerClient()`로 클라이언트를 만든 뒤 이 팩토리에 넘긴다.
 */
export function createSupabaseRepositories(client: SupabaseClient<Database>) {
  return {
    sessionRepository: createSupabaseSessionRepository(client),
    templateRepository: createSupabaseTemplateRepository(client),
  };
}

export { createSupabaseSessionRepository, createSupabaseTemplateRepository };
