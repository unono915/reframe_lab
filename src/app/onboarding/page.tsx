import { LinkButton } from "@/components/ui";

/**
 * S-01 Onboarding 골격 (DESIGN.md §10.1). PRD F-01의 전체 온보딩 동의·설명 Flow는
 * Phase 3(인증)·§9-G(AI 전송 정책 문구) 결정과 함께 구현한다. Phase 1은 단일 정적 화면만 둔다.
 */
export default function OnboardingPage() {
  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <OverlappingFramesSymbol />
        <div className="flex flex-col gap-3">
          <h1 className="text-display-lg font-bold text-ink">
            답을 받기 전에,
            <br />
            장면을 한 번 더 봅니다.
          </h1>
          <p className="text-body text-text-secondary">
            다시봄은 AI가 대신 답을 정의하지 않아요.
            <br />
            먼저 쓰고, 한 번에 하나의 질문으로 생각을 넓혀가요.
          </p>
        </div>
      </div>
      <div className="px-6 pb-6">
        <LinkButton href="/auth/login" variant="primary" fullWidth>
          시작하기
        </LinkButton>
      </div>
    </main>
  );
}

/**
 * DESIGN.md §3.2: 어긋나게 겹친 두 개의 둥근 Frame/Lens. 임시 Vector이며
 * 영구 Brand Asset으로 확정하려면 사용자 확인이 필요하다(§17.7 Human Input).
 */
function OverlappingFramesSymbol() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
      className="text-brand"
    >
      <rect
        x="14"
        y="22"
        width="52"
        height="52"
        rx="16"
        stroke="currentColor"
        strokeWidth="3"
      />
      <rect
        x="30"
        y="22"
        width="52"
        height="52"
        rx="16"
        stroke="var(--color-brand-strong)"
        strokeWidth="3"
      />
    </svg>
  );
}
