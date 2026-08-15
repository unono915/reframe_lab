import type { APIRequestContext } from "@playwright/test";

/**
 * 전용 E2E 계정이 재사용되므로("1 사용자당 활성 세션 1개" DB 제약과 맞물려), 이전
 * 테스트가 남긴 활성 세션이 있으면 다음 테스트가 `/training/new`에서 그 세션을
 * 이어받아 "1 / 7 관찰"을 기대하는 assertion이 깨진다. 매 테스트 전에 정리한다.
 */
export async function resetActiveSession(request: APIRequestContext): Promise<void> {
  const res = await request.get("/api/sessions?status=active");
  if (!res.ok()) return;
  const body = (await res.json()) as { snapshot: { session: { id: string } } | null };
  if (body.snapshot) {
    await request.delete(`/api/sessions/${body.snapshot.session.id}`);
  }
}
