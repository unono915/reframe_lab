"use client";

import { Card, Stack } from "@/components/ui";

/**
 * AI 응답을 기다리는 동안 보여주는 카드 (DESIGN.md §11 "AI Loading", §9.18
 * Loading & Skeleton).
 *
 * 왜 버튼 라벨만으로는 부족한가: 제공자 타임아웃이 20초다. 그동안 화면에서 바뀌는
 * 것이 버튼 글자 하나뿐이면, 사용자는 눌린 건지 멈춘 건지 알 수 없다 — 이 프로젝트에서
 * 네 번 재발한 "힌트 버튼이 침묵한다"와 사용자 입장에서는 구분되지 않는 모양이다.
 *
 * §9.18이 정한 것을 그대로 따른다:
 * - Skeleton Surface는 `cream`, Radius는 최종 컴포넌트와 동일
 * - **Flat Pulse만** 쓴다(opacity 변화). Shimmer Gradient·회전 로더 금지
 * - 최종 카드와 비슷한 크기로 잡아 Layout Shift를 줄인다
 * - 사용자의 이전 입력은 계속 보이게 둔다 — 이 카드는 그 자리를 덮지 않고 덧붙는다
 *
 * `prefers-reduced-motion: reduce`에서는 §12.3에 따라 Pulse를 없애고 문장만 남긴다
 * (`motion-safe:`가 그 처리를 한다). 무엇을 기다리는지는 애니메이션이 아니라
 * 문장이 알려주므로 정보는 그대로다.
 */
export function CoachLoadingCard({ label }: { label: string }) {
  return (
    <Card variant="coach" aria-busy="true">
      <Stack gap={3}>
        <p role="status" className="text-body-lg text-ink">
          {label}
        </p>
        {/* 곧 들어올 문장이 차지할 자리를 미리 잡아둔다. 읽을 내용이 없으므로 숨긴다. */}
        <div aria-hidden="true" className="flex flex-col gap-2">
          <div className="motion-safe:animate-pulse h-4 w-full rounded-sm bg-cream" />
          <div className="motion-safe:animate-pulse h-4 w-3/5 rounded-sm bg-cream" />
        </div>
      </Stack>
    </Card>
  );
}
