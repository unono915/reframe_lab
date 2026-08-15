"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Stack } from "@/components/ui";
import { stageIndex, stageLabel, TOTAL_ACTIVE_STAGES } from "@/domain/training/stages";
import { PastStagesSummary } from "./PastStagesSummary";
import { useTrainingSession } from "./TrainingSessionProvider";

export interface StageShellProps {
  /** 단계 안내 1~2줄 (DESIGN.md §10.3 Body 1번). */
  description: string;
  /** 사용자 입력·선택 영역. */
  children: ReactNode;
  /** Primary Action 라벨. 기본 "다음 질문으로". */
  primaryLabel?: string;
  /**
   * advance() 대신 별도 제출 로직이 필요하면 넘긴다(예: 입력 저장 후 advance).
   * advance()와 같은 결과 형태를 반환해야 오류 메시지를 동일하게 보여줄 수 있다.
   */
  onPrimaryAction?: () => Promise<{ ok: true } | { ok: false; message: string }>;
}

/**
 * S-03 Training Session 골격(DESIGN.md §10.3). 모든 단계 화면이 이 안에 렌더된다 —
 * 진행 표시·저장 상태·Sticky Action을 화면마다 새로 만들지 않는다.
 */
export function StageShell({
  description,
  children,
  primaryLabel = "다음 질문으로",
  onPrimaryAction,
}: StageShellProps) {
  const router = useRouter();
  const { snapshot, canAdvance, advance, pause, conflictingDrafts, dismissConflictingDraft } =
    useTrainingSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!snapshot) return null;

  const currentStage = snapshot.session.currentStage;
  const position = stageIndex(currentStage) + 1;

  async function handleExit() {
    await pause();
    router.push("/");
  }

  async function handlePrimary() {
    setError(null);
    setPending(true);
    try {
      const result = onPrimaryAction ? await onPrimaryAction() : await advance();
      if (!result.ok) {
        setError(result.message);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "저장하지 못했습니다. 작성한 내용은 그대로 있어요.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col">
      <header className="flex h-[var(--size-app-bar)] items-center justify-between border-b border-divider px-5">
        <Button variant="tertiary" onClick={handleExit} aria-label="훈련 나가기">
          나가기
        </Button>
        <p className="text-label font-bold text-text-secondary" aria-live="polite">
          {position} / {TOTAL_ACTIVE_STAGES} {stageLabel(currentStage)}
        </p>
        <span aria-hidden="true" className="w-16" />
      </header>

      {conflictingDrafts.length > 0 && (
        <div className="mx-auto w-full max-w-[640px] px-5 pt-4">
          <Stack gap={2}>
            {conflictingDrafts.map((draft) => (
              <div
                key={`${draft.stage}:${draft.promptKey}`}
                role="status"
                className="rounded-control bg-warm-gray px-4 py-3"
              >
                <p className="text-label font-bold text-ink">
                  다른 기기에서 이미 지나간 &apos;{stageLabel(draft.stage)}&apos; 단계에
                  이 기기에만 저장된 내용이 있어요.
                </p>
                <p className="mt-1 text-caption text-text-secondary">{draft.content}</p>
                <Button
                  type="button"
                  variant="tertiary"
                  className="mt-2"
                  onClick={() => dismissConflictingDraft(draft)}
                >
                  확인했어요, 지우기
                </Button>
              </div>
            ))}
          </Stack>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-6 px-5 py-6">
        <p className="text-body text-text-secondary">{description}</p>
        {children}
        <PastStagesSummary currentStage={currentStage} />
      </main>

      <footer className="border-t border-divider px-5 py-4">
        <Stack gap={2}>
          {error && (
            <p role="alert" className="text-caption font-bold text-danger">
              {error}
            </p>
          )}
          <Button
            variant="primary"
            fullWidth
            disabled={pending || (!onPrimaryAction && !canAdvance)}
            onClick={handlePrimary}
          >
            {pending ? "저장 중" : primaryLabel}
          </Button>
        </Stack>
      </footer>
    </div>
  );
}
