import { Card, LinkButton, Stack } from "@/components/ui";

/**
 * S-02 Home 골격 (DESIGN.md §10.2). Phase 1은 데이터 계층이 없으므로 정적 Placeholder만 둔다.
 * 실제 오늘의 렌즈 선택(domain/templates/selection.ts)과 진행 중 세션 조회는 Phase 2~3에서 연결한다.
 */
export default function HomePage() {
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-[640px] flex-col justify-center px-5 py-10">
      <Stack gap={8}>
        <Card variant="daily">
          <Stack gap={3}>
            <p className="text-label font-bold text-brand-strong">오늘 다시 볼 장면</p>
            <p className="text-display-md font-bold text-ink">
              반복해서 놓치는 순간이 있었나요?
            </p>
          </Stack>
        </Card>
        <LinkButton href="/onboarding" variant="primary" fullWidth>
          오늘의 훈련 시작
        </LinkButton>
      </Stack>
    </main>
  );
}
