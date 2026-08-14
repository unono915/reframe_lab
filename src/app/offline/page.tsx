import { Card, Stack } from "@/components/ui";

/**
 * Service Worker의 navigation fallback(sw.ts) 대상. 네트워크가 없어 새 페이지를
 * 아예 불러오지 못할 때만 보인다 — 이미 캐시된 페이지(Home 등)는 그대로 열린다.
 * 작성 중인 초안 자체를 보존하는 로직은 Phase 2 lib/persistence/drafts.ts에서 다룬다.
 */
export default function OfflinePage() {
  return (
    <main className="pt-safe pb-safe flex min-h-dvh items-center justify-center px-6">
      <Card variant="neutral" className="w-full max-w-[420px] text-center">
        <Stack gap={3} align="center">
          <p className="text-heading-3 font-bold text-ink">오프라인이에요</p>
          <p className="text-body text-text-secondary">
            인터넷 연결을 확인해주세요. 이미 열어둔 페이지는 계속 사용할 수 있고, 작성한
            내용은 이 기기에 남아 있어요.
          </p>
        </Stack>
      </Card>
    </main>
  );
}
