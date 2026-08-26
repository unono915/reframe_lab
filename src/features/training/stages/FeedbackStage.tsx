"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Stack } from "@/components/ui";
import { SELF_CHECK_ITEMS, type SelfCheckKey } from "@/domain/training/requirements";
import { StageShell } from "../StageShell";
import { useTrainingSession } from "../TrainingSessionProvider";

export function FeedbackStage() {
  const router = useRouter();
  const { snapshot, requestFeedback, completeSelfCheck, advance } = useTrainingSession();
  const [feedbackPending, setFeedbackPending] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<SelfCheckKey>>(new Set());

  if (!snapshot) return null;

  const latestVersion = snapshot.problemDefinitionVersions.reduce<
    (typeof snapshot.problemDefinitionVersions)[number] | null
  >((max, v) => (!max || v.versionNumber > max.versionNumber ? v : max), null);

  const latestFeedback = snapshot.aiFeedbacks
    .filter((f) => !f.isStale && f.problemDefinitionVersionId === latestVersion?.id)
    .at(-1);

  // DESIGN.md §11 UI States "Stale Feedback": 앞선 단계를 고쳐서 이전 피드백이
  // 무효화된 경우, 조용히 "피드백 없음"으로 보이면 사용자가 왜 사라졌는지 알 수 없다.
  const staleFeedbackExists = snapshot.aiFeedbacks.some(
    (f) => f.isStale && f.problemDefinitionVersionId === latestVersion?.id,
  );

  const allChecked = checked.size === SELF_CHECK_ITEMS.length;

  async function handleGetFeedback() {
    setFeedbackPending(true);
    setFeedbackError(null);
    const result = await requestFeedback();
    setFeedbackPending(false);
    if (!result.ok) {
      setFeedbackError(result.message);
    }
  }

  async function handleCompleteSelfCheck() {
    await completeSelfCheck();
  }

  async function handlePrimaryAction() {
    const sessionId = snapshot?.session.id;
    const result = await advance();
    if (result.ok && sessionId) {
      router.push(`/result/${sessionId}`);
    }
    return result;
  }

  return (
    <StageShell
      description="지금까지의 생각을 돌아볼까요?"
      primaryLabel="이대로 완료하기"
      onPrimaryAction={handlePrimaryAction}
    >
      <Stack gap={6}>
        {latestVersion && (
          <Card variant="paper">
            <p className="text-label font-bold text-brand-strong">현재의 문제 정의</p>
            <p className="text-body-lg text-ink">{latestVersion.text}</p>
          </Card>
        )}

        {latestFeedback ? (
          <Stack gap={3}>
            <Card variant="coach">
              <p className="text-label font-bold text-brand-strong">이미 드러난 점</p>
              <p className="text-body text-ink">{latestFeedback.strength}</p>
            </Card>
            <Card variant="coach">
              <p className="text-label font-bold text-brand-strong">더 살펴볼 점</p>
              <p className="text-body text-ink">{latestFeedback.improvementFocus}</p>
            </Card>
            <Card variant="coach">
              <p className="text-label font-bold text-brand-strong">아직 가설인 점</p>
              <p className="text-body text-ink">{latestFeedback.unverifiedAssumption}</p>
            </Card>
            <p className="text-body-lg text-ink">{latestFeedback.nextQuestion}</p>
          </Stack>
        ) : (
          <Stack gap={2}>
            {staleFeedbackExists && (
              <Badge variant="stale">
                앞선 내용을 수정해 이 피드백을 다시 확인해야 해요.
              </Badge>
            )}
            {feedbackError && (
              <p role="alert" className="rounded-control bg-danger-bg px-4 py-3 text-label font-bold text-danger">
                {feedbackError} 아래 자기 점검으로도 완료할 수 있어요.
              </p>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={handleGetFeedback}
              disabled={feedbackPending}
            >
              {feedbackPending
                ? "AI 피드백 요청 중"
                : feedbackError
                  ? "다시 시도"
                  : staleFeedbackExists
                    ? "AI 피드백 다시 보기"
                    : "AI 피드백 보기"}
            </Button>
          </Stack>
        )}

        <Stack gap={3}>
          <p className="text-heading-3 font-bold text-ink">스스로 점검하기</p>
          <p className="text-caption text-text-secondary">
            AI 피드백 없이도 아래 항목을 스스로 확인하면 완료할 수 있어요.
          </p>
          {SELF_CHECK_ITEMS.map((item) => (
            <label key={item.key} className="flex items-center gap-3 text-body text-ink">
              <input
                type="checkbox"
                checked={checked.has(item.key)}
                onChange={(e) => {
                  setChecked((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(item.key);
                    else next.delete(item.key);
                    return next;
                  });
                }}
                className="h-5 w-5 accent-brand"
              />
              {item.label}
            </label>
          ))}
          <Button
            type="button"
            variant="tertiary"
            disabled={!allChecked}
            onClick={handleCompleteSelfCheck}
          >
            체크리스트 완료로 표시
          </Button>
        </Stack>
      </Stack>
    </StageShell>
  );
}
