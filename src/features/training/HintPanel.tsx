"use client";

import { Button, Card, Stack } from "@/components/ui";
import { CoachLoadingCard } from "./CoachLoadingCard";
import type { StageHint } from "./useStageHint";

/**
 * 코치에게 질문 하나를 받는 자리 (DESIGN.md §10.3 Body "필요할 때만 Helper와 Hint").
 *
 * 눌러야만 뜬다 — 이 앱은 사용자가 먼저 쓰고 AI는 그 뒤에 묻는다(원칙 1). 그래서
 * 코치가 먼저 말을 걸지 않고, 필요할 때 부를 수 있는 작은 버튼으로만 있는다.
 *
 * 세 상태 중 하나는 반드시 보인다: 기다리는 중 / 실패했음 / 받은 질문. "눌렀는데
 * 아무 일도 일어나지 않는다"가 이 저장소에서 네 번 재발했기 때문이다.
 */
export function HintPanel({
  hint,
  label = "막히면 질문 하나 받기",
}: {
  hint: StageHint;
  label?: string;
}) {
  const hasSomethingToShow =
    hint.pending || hint.error !== null || hint.question !== null;
  if (!hint.canRequest && !hasSomethingToShow) return null;

  return (
    <Stack gap={2}>
      {hint.canRequest && (
        <Button
          type="button"
          variant="tertiary"
          onClick={() => void hint.request()}
          disabled={hint.pending}
        >
          {hint.pending ? "질문을 받는 중" : hint.error ? "다시 시도" : label}
        </Button>
      )}
      {/* 최대 20초를 기다리는 자리다. 버튼 글자만 바뀌면 눌린 건지 멈춘 건지 알 수 없다. */}
      {hint.pending && <CoachLoadingCard label="다음 질문을 정리하고 있어요." />}
      {hint.error && (
        // 안심 문장은 실패 사유와 별개로 **항상** 붙인다(DESIGN.md §11 AI Error).
        // 메시지 문자열에 섞어 넣으면 서버가 더 구체적인 사유를 줄 때 사라진다 —
        // 정작 그때가 사용자가 가장 불안한 순간이다.
        <p role="alert" className="text-caption font-bold text-danger">
          {hint.error} 작성한 내용은 그대로 있어요.
        </p>
      )}
      {hint.question && !hint.pending && (
        <Card variant="coach">
          <p className="text-body-lg text-ink">{hint.question}</p>
        </Card>
      )}
    </Stack>
  );
}
