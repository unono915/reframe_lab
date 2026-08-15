import type { TrainingSessionSnapshot, TrainingTemplate } from "@/domain/types";

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
   * History·Growth용 — 활성 세션도 포함한 사용자의 전체 세션(최신순). Growth는
   * 이 목록에서 completed만 걸러 재계산하므로(`domain/growth/metrics.ts`) 별도
   * Growth 전용 조회를 두지 않는다.
   */
  listSessionsForUser(userId: string, limit?: number): Promise<TrainingSessionSnapshot[]>;
}

export interface TemplateRepository {
  listActiveTemplates(): Promise<TrainingTemplate[]>;
}
