import type {
  SessionSummary,
  TrainingSessionSnapshot,
  TrainingTemplate,
} from "@/domain/types";

/**
 * Repository 인터페이스. Phase 2는 `memory/`(인메모리) 구현만 존재하고,
 * Phase 3에서 Supabase 구현으로 교체된다 — 호출자는 이 인터페이스만 알면 된다
 * (DEVELOPMENT_PLAN.md §3.3 "AI 제공자·인증·DB는 Adapter/Repository 경계 뒤에 둔다").
 *
 * Phase 2에서는 세션 하나의 전체 산출물을 스냅샷 단위로 주고받는다 — 실제 REST 세부
 * 엔드포인트(단계별 POST 등)는 Phase 3에서 Route Handler가 이 Repository 위에 얹는다.
 */

export interface CreateSessionParams {
  userId: string;
  templateId: string;
  trainingDate: string;
  timezone: string;
  clientGeneratedId: string;
  /** Revisit(다시 생각하기) 세션일 때만 채운다 — 원본은 절대 수정하지 않는다. */
  originSessionId?: string;
}

export interface SessionRepository {
  createSession(params: CreateSessionParams): Promise<TrainingSessionSnapshot>;
  /** 완료·포기되지 않은 세션 하나. PRD: 사용자당 활성 세션은 최대 1개. */
  getActiveSessionForUser(userId: string): Promise<TrainingSessionSnapshot | null>;
  getSnapshot(sessionId: string): Promise<TrainingSessionSnapshot | null>;
  saveSnapshot(snapshot: TrainingSessionSnapshot): Promise<TrainingSessionSnapshot>;
  /** 오늘의 렌즈 선택 시 최근 노출 렌즈를 피하는 데 쓴다(domain/templates/selection.ts). */
  listRecentTemplateIds(userId: string, limit: number): Promise<string[]>;
  /** 개별 기록 삭제(History). 자식 산출물은 DB의 ON DELETE CASCADE로 함께 지워진다. */
  deleteSession(sessionId: string): Promise<void>;
  /**
   * History·Growth·Home용 조회 전용 요약 목록(최신순, 활성 세션 포함). 전체 스냅샷을
   * 반환하지 않는 이유는 `SessionSummary` 주석 참고 — 구현체는 세션 수와 무관하게
   * 고정된 개수의 쿼리만 써야 한다(세션마다 조회하면 N+1이 된다).
   */
  listSessionSummariesForUser(userId: string, limit?: number): Promise<SessionSummary[]>;
}

export interface TemplateRepository {
  listActiveTemplates(): Promise<TrainingTemplate[]>;
}
