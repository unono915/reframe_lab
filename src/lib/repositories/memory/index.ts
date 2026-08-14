import { createMemorySessionRepository } from "./session-repository";
import { createMemoryTemplateRepository } from "./template-repository";

/**
 * 모듈 싱글턴. SessionRepository는 IndexedDB로 저장되어 새로고침에도 살아남는다
 * (DEVELOPMENT_PLAN.md §10 Phase 2 완료 조건). 서버가 없다는 뜻의 "메모리"이지 이
 * 브라우저를 벗어나 저장된다는 뜻은 아니다 — 기기를 바꾸면 사라진다. §14-B 해결 후
 * Phase 3에서 Supabase 구현으로 이 두 팩토리 호출만 교체하면 된다.
 */
export const sessionRepository = createMemorySessionRepository();
export const templateRepository = createMemoryTemplateRepository();
