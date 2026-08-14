import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { TrainingSessionSnapshot } from "@/domain/types";
import type { CreateSessionParams, SessionRepository } from "../types";

/**
 * "인메모리" Repository지만 IndexedDB로 저장한다 — 순수 JS 힙(Map)에만 두면 새로고침 한 번에
 * 세션이 통째로 사라져 DEVELOPMENT_PLAN.md §10 Phase 2 완료 조건("새로고침 후 마지막 완료
 * 단계와 작성 중 초안이 복구됨")을 만족할 수 없다. 서버가 없다는 의미의 "메모리"이지,
 * 새로고침에 살아남지 않는다는 뜻은 아니다. 실제 서버 지속성은 Phase 3(§14-B)이 담당한다.
 */

interface SessionDBSchema extends DBSchema {
  sessions: {
    key: string;
    value: TrainingSessionSnapshot;
    indexes: { byUser: string };
  };
}

const DB_NAME = "reframe-lab-sessions";
const DB_VERSION = 1;
const STORE_NAME = "sessions";

let dbPromise: Promise<IDBPDatabase<SessionDBSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<SessionDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<SessionDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "session.id" });
        store.createIndex("byUser", "session.userId");
      },
    });
  }
  return dbPromise;
}

function isActiveStatus(status: string): boolean {
  return status !== "completed" && status !== "abandoned";
}

export function createMemorySessionRepository(): SessionRepository {
  return {
    async createSession(params: CreateSessionParams): Promise<TrainingSessionSnapshot> {
      const db = await getDB();
      const existingForUser = await db.getAllFromIndex(
        STORE_NAME,
        "byUser",
        params.userId,
      );
      const existing = existingForUser
        .filter((s) => isActiveStatus(s.session.status))
        .sort((a, b) => b.session.startedAt.localeCompare(a.session.startedAt))[0];
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
      await db.put(STORE_NAME, snapshot);
      return snapshot;
    },

    async getActiveSessionForUser(
      userId: string,
    ): Promise<TrainingSessionSnapshot | null> {
      const db = await getDB();
      const forUser = await db.getAllFromIndex(STORE_NAME, "byUser", userId);
      const found = forUser
        .filter((s) => isActiveStatus(s.session.status))
        .sort((a, b) => b.session.startedAt.localeCompare(a.session.startedAt))[0];
      return found ?? null;
    },

    async getSnapshot(sessionId: string): Promise<TrainingSessionSnapshot | null> {
      const db = await getDB();
      const found = await db.get(STORE_NAME, sessionId);
      return found ?? null;
    },

    async saveSnapshot(
      snapshot: TrainingSessionSnapshot,
    ): Promise<TrainingSessionSnapshot> {
      const db = await getDB();
      await db.put(STORE_NAME, snapshot);
      return snapshot;
    },

    async listRecentTemplateIds(userId: string, limit: number): Promise<string[]> {
      const db = await getDB();
      const forUser = await db.getAllFromIndex(STORE_NAME, "byUser", userId);
      return forUser
        .sort((a, b) => b.session.startedAt.localeCompare(a.session.startedAt))
        .slice(0, limit)
        .map((s) => s.session.templateId);
    },
  };
}
