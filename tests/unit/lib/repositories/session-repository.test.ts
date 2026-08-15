import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createMemorySessionRepository } from "@/lib/repositories/memory/session-repository";

let userCounter = 0;
function uniqueUserId(): string {
  userCounter += 1;
  return `user-${userCounter}`;
}

describe("createMemorySessionRepository", () => {
  const repo = createMemorySessionRepository();

  it("creates a session that starts at observation/stateVersion 0", async () => {
    const userId = uniqueUserId();
    const snapshot = await repo.createSession({
      userId,
      templateId: "template-1",
      trainingDate: "2026-08-15",
      timezone: "Asia/Seoul",
      clientGeneratedId: "client-1",
    });
    expect(snapshot.session.status).toBe("observation");
    expect(snapshot.session.currentStage).toBe("observation");
    expect(snapshot.session.stateVersion).toBe(0);
  });

  it("is idempotent — creating again for a user with an active session returns the same one", async () => {
    const userId = uniqueUserId();
    const first = await repo.createSession({
      userId,
      templateId: "template-1",
      trainingDate: "2026-08-15",
      timezone: "Asia/Seoul",
      clientGeneratedId: "client-1",
    });
    const second = await repo.createSession({
      userId,
      templateId: "template-2",
      trainingDate: "2026-08-15",
      timezone: "Asia/Seoul",
      clientGeneratedId: "client-2",
    });
    expect(second.session.id).toBe(first.session.id);
  });

  it("creates a new session once the previous one is completed", async () => {
    const userId = uniqueUserId();
    const first = await repo.createSession({
      userId,
      templateId: "template-1",
      trainingDate: "2026-08-15",
      timezone: "Asia/Seoul",
      clientGeneratedId: "client-1",
    });
    await repo.saveSnapshot({
      ...first,
      session: { ...first.session, status: "completed" },
    });

    const second = await repo.createSession({
      userId,
      templateId: "template-2",
      trainingDate: "2026-08-16",
      timezone: "Asia/Seoul",
      clientGeneratedId: "client-2",
    });
    expect(second.session.id).not.toBe(first.session.id);
  });

  it("round-trips a saved snapshot via getSnapshot — this is what survives a page reload", async () => {
    const userId = uniqueUserId();
    const created = await repo.createSession({
      userId,
      templateId: "template-1",
      trainingDate: "2026-08-15",
      timezone: "Asia/Seoul",
      clientGeneratedId: "client-1",
    });
    const edited = {
      ...created,
      observation: {
        id: "obs-1",
        sessionId: created.session.id,
        rawText: "장면",
        version: 1,
        createdAt: "2026-08-15T00:00:00.000Z",
        updatedAt: "2026-08-15T00:00:00.000Z",
      },
    };
    await repo.saveSnapshot(edited);

    // 새 Repository 인스턴스 = 새로고침 시 모듈이 다시 초기화되는 상황을 흉내낸다.
    // IndexedDB는 프로세스가 아니라 브라우저에 저장되므로 새 인스턴스에서도 보인다.
    const reloaded = await createMemorySessionRepository().getSnapshot(
      created.session.id,
    );
    expect(reloaded?.observation?.rawText).toBe("장면");
  });

  it("returns null for an unknown session id", async () => {
    expect(await repo.getSnapshot("does-not-exist")).toBeNull();
  });

  it("getActiveSessionForUser excludes completed and abandoned sessions", async () => {
    const userId = uniqueUserId();
    const created = await repo.createSession({
      userId,
      templateId: "template-1",
      trainingDate: "2026-08-15",
      timezone: "Asia/Seoul",
      clientGeneratedId: "client-1",
    });
    await repo.saveSnapshot({
      ...created,
      session: { ...created.session, status: "completed" },
    });
    expect(await repo.getActiveSessionForUser(userId)).toBeNull();
  });

  it("listRecentTemplateIds returns this user's template ids, most recent first", async () => {
    const userId = uniqueUserId();
    const first = await repo.createSession({
      userId,
      templateId: "template-a",
      trainingDate: "2026-08-14",
      timezone: "Asia/Seoul",
      clientGeneratedId: "c1",
    });
    await repo.saveSnapshot({
      ...first,
      session: { ...first.session, status: "completed" },
    });
    // startedAt은 ms 단위 ISO 문자열이다 — 같은 ms 안에 생성되면 정렬이 모호해지므로
    // (실제 사용에서는 세션 생성이 하루 한 번이라 벌어지지 않는 상황) 테스트에서만 벌린다.
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await repo.createSession({
      userId,
      templateId: "template-b",
      trainingDate: "2026-08-15",
      timezone: "Asia/Seoul",
      clientGeneratedId: "c2",
    });
    void second;

    const recent = await repo.listRecentTemplateIds(userId, 5);
    expect(recent[0]).toBe("template-b");
    expect(recent).toContain("template-a");
  });

  it("listSessionsForUser returns this user's sessions most-recent-first, regardless of status", async () => {
    const userId = uniqueUserId();
    const first = await repo.createSession({
      userId,
      templateId: "template-a",
      trainingDate: "2026-08-14",
      timezone: "Asia/Seoul",
      clientGeneratedId: "c1",
    });
    await repo.saveSnapshot({
      ...first,
      session: { ...first.session, status: "completed" },
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await repo.createSession({
      userId,
      templateId: "template-b",
      trainingDate: "2026-08-15",
      timezone: "Asia/Seoul",
      clientGeneratedId: "c2",
    });

    const listed = await repo.listSessionsForUser(userId, 10);
    expect(listed).toHaveLength(2);
    expect(listed[0]?.session.id).toBe(second.session.id);
    expect(listed.map((s) => s.session.id)).toContain(first.session.id);
  });
});

describe("createMemorySessionRepository — isolation across users", () => {
  const repo = createMemorySessionRepository();

  beforeEach(() => {
    userCounter += 1000; // avoid collisions with the describe block above
  });

  it("never returns another user's active session", async () => {
    const userA = uniqueUserId();
    const userB = uniqueUserId();
    await repo.createSession({
      userId: userA,
      templateId: "template-1",
      trainingDate: "2026-08-15",
      timezone: "Asia/Seoul",
      clientGeneratedId: "c1",
    });
    expect(await repo.getActiveSessionForUser(userB)).toBeNull();
  });
});
