import { createMemorySessionRepository } from "./session-repository";
import { createMemoryTemplateRepository } from "./template-repository";

/**
 * 모듈 싱글턴 — 같은 브라우저 탭이 살아있는 동안은 페이지 이동에도 데이터가 유지된다.
 * 전체 새로고침에는 살아남지 않는다(Phase 2는 서버 저장이 없다). §14-B 해결 후
 * Phase 3에서 Supabase 구현으로 이 두 팩토리 호출만 교체하면 된다.
 */
export const sessionRepository = createMemorySessionRepository();
export const templateRepository = createMemoryTemplateRepository();
