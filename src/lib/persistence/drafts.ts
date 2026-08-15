import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Stage } from "@/domain/types";

/**
 * IndexedDB 초안 저장소 — "입력 유실 방지"(CLAUDE.md 원칙 7)의 1차 방어선.
 * 입력 변화마다 debounce(500ms) 후 여기에 저장하고, 단계 제출 시에는 서버(Phase 3부터) 확정
 * 저장을 별도로 한다(DEVELOPMENT_PLAN.md §7.5). 브라우저 종료 이벤트에만 의존하지 않는다.
 */

export interface DraftRecord {
  sessionId: string;
  stage: Stage;
  promptKey: string;
  content: string;
  updatedAt: string;
  schemaVersion: number;
}

interface DraftDBSchema extends DBSchema {
  drafts: {
    key: string;
    value: DraftRecord;
    indexes: { bySession: string };
  };
}

const DB_NAME = "reframe-lab-drafts";
const DB_VERSION = 1;
const STORE_NAME = "drafts";
export const CURRENT_DRAFT_SCHEMA_VERSION = 1;

/** 세션+단계+prompt 조합을 out-of-line key로 쓴다 — DraftRecord 자체에는 key 필드가 없다. */
function draftKey(sessionId: string, stage: Stage, promptKey: string): string {
  return `${sessionId}:${stage}:${promptKey}`;
}

let dbPromise: Promise<IDBPDatabase<DraftDBSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<DraftDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<DraftDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME);
        store.createIndex("bySession", "sessionId");
      },
    });
  }
  return dbPromise;
}

export interface SaveDraftParams {
  sessionId: string;
  stage: Stage;
  promptKey: string;
  content: string;
}

export async function saveDraft(params: SaveDraftParams): Promise<DraftRecord> {
  const db = await getDB();
  const record: DraftRecord = {
    sessionId: params.sessionId,
    stage: params.stage,
    promptKey: params.promptKey,
    content: params.content,
    updatedAt: new Date().toISOString(),
    schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
  };
  await db.put(
    STORE_NAME,
    record,
    draftKey(params.sessionId, params.stage, params.promptKey),
  );
  return record;
}

export async function getDraft(
  sessionId: string,
  stage: Stage,
  promptKey: string,
): Promise<DraftRecord | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, draftKey(sessionId, stage, promptKey));
}

export async function getDraftsForSession(sessionId: string): Promise<DraftRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex(STORE_NAME, "bySession", sessionId);
}

export async function deleteDraft(
  sessionId: string,
  stage: Stage,
  promptKey: string,
): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, draftKey(sessionId, stage, promptKey));
}

/** 단계 제출이 서버에 확정된 뒤, 더 이상 필요 없는 세션의 초안을 전부 지운다. */
export async function clearSessionDrafts(sessionId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  let cursor = await tx.store.index("bySession").openCursor(sessionId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export interface DebouncedDraftSaver {
  (params: SaveDraftParams): void;
  /**
   * 대기 중인 저장을 실행하지 않고 취소한다. 다음 단계로 넘어가는 순간(advance) 이
   * 없으면, debounce 타이머가 전환 이후에 뒤늦게 발동해 이미 지나간 단계의 초안을
   * 되살려 놓는 경쟁 상태가 생긴다 — 실제 Playwright E2E로 재현했다(원칙 7과 같은 종류의 버그).
   */
  cancelPending: () => void;
}

/**
 * 입력 변화마다 즉시 쓰지 않고 마지막 변경 후 delayMs가 지나면 한 번만 저장한다.
 * React에 종속되지 않은 순수 클로저라 `features/training`의 어떤 훅에서도 재사용할 수 있다.
 */
export function createDebouncedDraftSaver(delayMs = 500): DebouncedDraftSaver {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debouncedSave = (params: SaveDraftParams): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void saveDraft(params);
    }, delayMs);
  };
  debouncedSave.cancelPending = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  return debouncedSave;
}
