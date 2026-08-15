"use client";

import { Button, Card, LinkButton, Stack } from "@/components/ui";

/**
 * Service Worker의 navigation fallback(sw.ts) 대상. 네트워크가 없어 새 페이지를
 * 아예 불러오지 못할 때만 보인다 — 이미 캐시된 페이지(Home 등)는 그대로 열린다.
 * 작성 중인 초안 자체를 보존하는 로직은 Phase 2 lib/persistence/drafts.ts에서 다룬다.
 *
 * 빠져나갈 경로를 반드시 준다. Home은 Service Worker가 프리캐시하므로 오프라인에서도
 * 열린다 — 안내만 하고 끝내면 사용자는 뒤로가기 말고는 할 수 있는 게 없다
 * (Phase 6 "오류 복구: 다음에 무엇을 할 수 있는지").
 */
export default function OfflinePage() {
  return (
    <main className="pt-safe pb-safe flex min-h-dvh items-center justify-center px-6">
      <Card variant="neutral" className="w-full max-w-sm text-center">
        <Stack gap={4} align="center">
          <h1 className="text-heading-3 font-bold text-ink">오프라인이에요</h1>
          <p className="text-body text-text-secondary">
            인터넷 연결을 확인해주세요. 이미 열어둔 페이지는 계속 사용할 수 있고, 작성한
            내용은 이 기기에 남아 있어요.
          </p>
          <Stack gap={2} className="w-full">
            <Button type="button" variant="primary" fullWidth onClick={() => location.reload()}>
              다시 시도
            </Button>
            <LinkButton href="/" variant="tertiary" fullWidth>
              홈으로 돌아가기
            </LinkButton>
          </Stack>
        </Stack>
      </Card>
    </main>
  );
}
