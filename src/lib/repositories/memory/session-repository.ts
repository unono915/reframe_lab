import type { TrainingSessionSnapshot } from "@/domain/types";
import type { CreateSessionParams, SessionRepository } from "../types";

/**
 * 인메모리 SessionRepository. Phase 2~3 초기 개발/테스트용이며 프로세스가 죽으면 사라진다.
 * 실제 지속성은 Phase 3의 Supabase 구현이 담당한다.
 */
export function createMemorySessionRepository(): SessionRepository {
  const sessions = new Map<string, TrainingSessionSnapshot>();

  function isActiveStatus(status: string): boolean {
    return status !== "completed" && status !== "abandoned";
  }

  return {
    async createSession(params: CreateSessionParams): Promise<TrainingSessionSnapshot> {
      const existing = [...sessions.values()].find(
        (s) => s.session.userId === params.userId && isActiveStatus(s.session.status),
      );
      if (existing) return existing;

      const now = new Date().toISOString();
      const snapshot: TrainingSessionSnapshot = {
        session: {
          id: crypto.randomUUID(),
          clientGeneratedId: params.clientGeneratedId,
          userId: params.userId,
          templateId: params.templateId,
          trainingDate: params.trainingDate,
          timezone: params.timezone,
          status: "observation",
          currentStage: "observation",
          lastActiveStage: null,
          stateVersion: 0,
          aiCallCount: 0,
          startedAt: now,
          lastActiveAt: now,
          createdAt: now,
          updatedAt: now,
        },
        observation: null,
        observationItems: [],
        stageResponses: [],
        questions: [],
        perspectives: [],
        reframes: [],
        problemDefinitionVersions: [],
        aiFeedbacks: [],
        coachInteractions: [],
      };
      sessions.set(snapshot.session.id, snapshot);
      return snapshot;
    },

    async getActiveSessionForUser(
      userId: string,
    ): Promise<TrainingSessionSnapshot | null> {
      const found = [...sessions.values()]
        .filter((s) => s.session.userId === userId && isActiveStatus(s.session.status))
        .sort((a, b) => b.session.startedAt.localeCompare(a.session.startedAt))[0];
      return found ?? null;
    },

    async getSnapshot(sessionId: string): Promise<TrainingSessionSnapshot | null> {
      return sessions.get(sessionId) ?? null;
    },

    async saveSnapshot(
      snapshot: TrainingSessionSnapshot,
    ): Promise<TrainingSessionSnapshot> {
      sessions.set(snapshot.session.id, snapshot);
      return snapshot;
    },

    async listRecentTemplateIds(userId: string, limit: number): Promise<string[]> {
      return [...sessions.values()]
        .filter((s) => s.session.userId === userId)
        .sort((a, b) => b.session.startedAt.localeCompare(a.session.startedAt))
        .slice(0, limit)
        .map((s) => s.session.templateId);
    },
  };
}
