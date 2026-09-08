"use client";

import { useState, useSyncExternalStore } from "react";
import { Button, LinkButton, Stack } from "@/components/ui";

/**
 * 온보딩을 봤다는 표시. 미들웨어가 이 쿠키를 보고 처음 오는 사람만 이 화면으로
 * 보낸다(`lib/supabase/middleware.ts`).
 *
 * 보안 경계가 아니라 화면 흐름용이라 클라이언트에서 세우는 쿠키로 충분하다 —
 * 지워도 잃는 것이 없고, 소개 화면을 한 번 더 볼 뿐이다. 그래서 httpOnly가 아니다.
 */
function markOnboardingSeen(): void {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `onboarding_seen=1; path=/; max-age=${oneYear}; samesite=lax`;
  clearProgress();
}

/**
 * 어디까지 봤는지. PRD F-01은 "사용자가 중간에 종료하면 다음 실행 시 마지막 온보딩
 * 단계부터 재개한다"고 정하고 완료 조건에도 같은 항목이 있는데, 지금까지는 화면
 * 상태로만 들고 있어서 앱을 닫으면 처음 화면으로 돌아갔다.
 *
 * 서버에 둘 이유는 없다 — 로그인 전 화면이고, 잃어도 소개를 한 번 더 볼 뿐이다.
 * 사생활 보호 모드처럼 저장소 접근 자체가 막힌 환경이 있어 읽기·쓰기 모두 감싼다.
 */
const PROGRESS_KEY = "onboarding_step";

/** 이 값을 바꾸는 것은 이 화면뿐이라 외부 변경 알림이 필요 없다. */
function subscribeNothing(): () => void {
  return () => {};
}

function readProgress(): number {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveProgress(index: number): void {
  try {
    window.localStorage.setItem(PROGRESS_KEY, String(index));
  } catch {
    // 저장하지 못해도 온보딩 자체는 볼 수 있어야 한다.
  }
}

function clearProgress(): void {
  try {
    window.localStorage.removeItem(PROGRESS_KEY);
  } catch {
    // 지우지 못해도 `onboarding_seen` 쿠키가 있으면 이 화면으로 다시 오지 않는다.
  }
}

/**
 * S-01 Onboarding (DESIGN.md §10.1).
 *
 * 예전에는 한 화면에 첫 문구만 있었다. DESIGN.md가 정한 구성(진행 Dot → Symbol →
 * 한 화면 한 문장 → 짧은 설명 → 하단 Sticky Button)과 세 개의 핵심 문구를 그대로
 * 따른다. "한 화면에 제품 원칙을 모두 나열하지 않는다"는 규칙 때문에 세 화면으로 나눈다.
 *
 * 이 화면이 하는 일은 기대치를 맞추는 것이다 — 사용자는 답을 받으러 왔다가 질문을
 * 받게 되므로, 그 방향이 뒤집혀 있다는 것을 먼저 알아야 첫 단계에서 당황하지 않는다.
 *
 * ⚠️ PRD F-01은 "데이터 저장 및 AI API 전송에 대한 핵심 안내"도 요구하지만, 그 문구는
 * §14-G(Human Input)에서 사용자가 정하기로 되어 있다. 검토되지 않은 개인정보 문구를
 * 사용자에게 보여줄 수는 없으므로 그 단계는 아직 넣지 않았다 — §14-G가 정해지면
 * 여기에 한 화면을 더한다.
 */

interface OnboardingStep {
  headline: string;
  /** DESIGN.md §10.1 "짧은 설명 2~3줄". */
  body: string[];
}

const STEPS: OnboardingStep[] = [
  {
    headline: "답을 받기 전에,\n장면을 한 번 더 봅니다.",
    body: [
      "일상에서 그냥 지나친 장면 하나를 골라",
      "무엇이 실제로 일어났는지부터 적어봐요.",
    ],
  },
  {
    headline: "AI는 대신 정의하지 않고\n한 가지씩 질문합니다.",
    body: [
      "먼저 쓰기 전에는 코치가 끼어들지 않아요.",
      "답을 주는 대신 한 번에 하나씩만 물어봐요.",
    ],
  },
  {
    headline: "하루 5분,\n생각이 달라진 과정을 남깁니다.",
    body: [
      "일곱 단계를 지나며 처음 생각과 지금 생각을 나란히 남겨요.",
      "매일 완벽하게 하지 않아도 괜찮아요.",
    ],
  },
];

export default function OnboardingPage() {
  /*
    이어서 볼 자리는 브라우저에만 있는 값이라 서버 렌더에는 없다. `useSyncExternalStore`
    는 정확히 그 경우를 위한 것이다 — 서버 스냅샷은 0으로 그리고, 클라이언트에서
    저장된 값으로 다시 그린다. 초기 state에서 곧바로 읽으면 hydration이 어긋나고,
    effect에서 setState하면 렌더가 한 번 더 도는 것을 lint가 막는다.

    쓰는 쪽은 우리뿐이라 구독은 아무 일도 하지 않는다. 사용자가 "다음"을 누르면
    `advanced`가 그 값을 덮는다.
  */
  const restored = useSyncExternalStore(subscribeNothing, readProgress, () => 0);
  const [advanced, setAdvanced] = useState<number | null>(null);
  const index = Math.min(advanced ?? restored, STEPS.length - 1);
  const setIndex = (next: (current: number) => number) => setAdvanced(next(index));
  // STEPS는 상수라 인덱스가 벗어날 수 없지만, noUncheckedIndexedAccess 아래에서는
  // 타입상 undefined가 가능하다 — 단언 대신 첫 화면으로 떨어뜨린다.
  const step = STEPS[index] ?? STEPS[0]!;
  const isLast = index === STEPS.length - 1;

  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col">
      <header className="flex justify-center px-6 pt-6">
        <ProgressDots total={STEPS.length} current={index} />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <OverlappingFramesSymbol />
        <Stack gap={3}>
          {/*
            화면마다 문장이 바뀌므로 aria-live로 알린다 — 시각적으로는 전환이
            분명하지만 스크린리더에는 아무 일도 일어나지 않은 것처럼 들린다.
          */}
          <h1
            className="whitespace-pre-line text-display-lg font-bold text-ink"
            aria-live="polite"
          >
            {step.headline}
          </h1>
          <p className="text-body text-text-secondary">
            {step.body.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
        </Stack>
      </div>

      <div className="px-6 pb-6">
        <Stack gap={2}>
          {isLast ? (
            <LinkButton
              href="/auth/login"
              variant="primary"
              fullWidth
              onClick={markOnboardingSeen}
            >
              시작하기
            </LinkButton>
          ) : (
            <Button
              type="button"
              variant="primary"
              fullWidth
              onClick={() =>
                setIndex((i) => {
                  const next = i + 1;
                  saveProgress(next);
                  return next;
                })
              }
            >
              다음
            </Button>
          )}
          {/*
            건너뛰기를 두는 이유 — 다시 설치했거나 이미 아는 사용자를 세 화면
            붙잡아 두면 첫 훈련까지 가는 길만 길어진다. DESIGN.md §10.1은 "첫 화면부터
            회원가입 Form을 중심에 두지 않는다"만 요구하고 Skip은 막지 않는다.
          */}
          {!isLast && (
            <LinkButton
              href="/auth/login"
              variant="tertiary"
              fullWidth
              onClick={markOnboardingSeen}
            >
              건너뛰기
            </LinkButton>
          )}
        </Stack>
      </div>
    </main>
  );
}

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div
      className="flex items-center gap-2"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
      aria-label={`온보딩 ${current + 1} / ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={
            i === current
              ? "h-2 w-6 rounded-full bg-brand transition-all"
              : "h-2 w-2 rounded-full bg-border transition-all"
          }
        />
      ))}
    </div>
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
