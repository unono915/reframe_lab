"use client";

import { useRef, useState } from "react";
import { Button, Card, Field, InlineError, Stack, Textarea } from "@/components/ui";
import { INPUT_LIMITS } from "@/lib/schemas/stage-input";
import { EXCEPTION_PROMPT_KEYS } from "@/domain/training/requirements";
import { CoachLoadingCard } from "../CoachLoadingCard";
import { StageShell } from "../StageShell";
import { useTrainingSession } from "../TrainingSessionProvider";
import { useStageHint } from "../useStageHint";
import { useMutationAction } from "../useMutationAction";

export function QuestioningStage() {
  const {
    snapshot,
    addQuestion,
    markPriorityQuestion,
    submitExceptionReason,
    awaitLatestSnapshot,
    advance,
  } = useTrainingSession();
  const [text, setText] = useState("");
  /*
    힌트 상태는 `useStageHint`가 전부 들고 있다 — 단계 계산, User-first gate, 대기·오류
    표시가 화면마다 갈라지지 않게 하기 위해서다(그 훅 주석에 왜 그런지 적어두었다).
    이 화면만 버튼 자리가 달라서(입력 옆) 패널 대신 훅만 쓴다.
  */
  const hint = useStageHint("questioning");
  const [prioritySelectionId, setPrioritySelectionId] = useState<string | null>(null);
  const [priorityReason, setPriorityReason] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const addAction = useMutationAction();
  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  const priorityAction = useMutationAction();

  if (!snapshot) return null;
  const questions = snapshot.questions.filter((q) => q.authorType === "user");

  async function handleAdd() {
    if (!text.trim()) return;
    // 먼저 지우고 제출한다 — await 이후에 지우면 저장을 기다리는 동안 사용자가 다음
    // 질문을 입력했을 때 뒤늦은 초기화가 그 입력을 지워버린다(실제로 재현됨: 연속으로
    // 질문 3개를 빠르게 추가하면 그중 하나가 조용히 사라졌다).
    const submitted = text;
    // 힌트를 한 번도 안 받았으면 0이다. 받았다면 **본 것 중 가장 강한** 단계다.
    const submittedHintLevel = hint.usedHintLevel;
    setText("");
    hint.clear();
    // 다음 항목을 바로 이어 쓸 수 있게 입력창으로 focus를 돌린다. **await 앞에서**
    // 부르는 것이 중요하다 — iOS는 사용자 제스처가 살아 있는 동안에만 키보드를
    // 열어주므로, 저장을 기다린 뒤에 부르면 focus만 가고 키보드는 닫힌 채로 남는다.
    // 이 화면들은 3개·2개를 연달아 써야 해서, 매번 입력창을 다시 누르게 하면
    // 세션당 다섯 번의 불필요한 탭이 된다.
    questionInputRef.current?.focus();
    // 저장이 실패하면 방금 지운 질문을 되돌린다 — 그러지 않으면 사용자가 쓴 문장이
    // 서버에도 화면에도 남지 않는다(원칙 7).
    await addAction.run(
      () => addQuestion({ text: submitted }, submittedHintLevel),
      () => setText(submitted),
    );
  }

  async function handleConfirmPriority(questionId: string) {
    if (!priorityReason.trim()) return;
    const submitted = priorityReason;
    setPrioritySelectionId(null);
    setPriorityReason("");
    // 실패하면 고르던 화면과 적어둔 이유를 그대로 되살린다.
    await priorityAction.run(
      () => markPriorityQuestion(questionId, submitted),
      () => {
        setPrioritySelectionId(questionId);
        setPriorityReason(submitted);
      },
    );
  }

  async function handlePrimaryAction() {
    // 직전 질문 추가·핵심 질문 선택이 아직 큐에서 처리 중일 수 있으므로, 판단
    // 직전에 큐가 비워질 때까지 기다려 최신 상태로 다시 센다(원칙 7과 같은 종류의 버그).
    const latest = await awaitLatestSnapshot();
    const latestQuestions =
      latest?.questions.filter((q) => q.authorType === "user") ?? questions;
    const latestHasPriority = latestQuestions.some((q) => q.isPriority);
    if (latestQuestions.length < 3 || !latestHasPriority) {
      if (
        latestQuestions.length >= 1 &&
        hint.usedHintLevel >= 2 &&
        exceptionReason.trim()
      ) {
        await submitExceptionReason(EXCEPTION_PROMPT_KEYS.questioning, exceptionReason);
      } else {
        return {
          ok: false as const,
          message: "질문을 3개 이상 적고 핵심 질문을 골라주세요.",
        };
      }
    }
    return advance();
  }

  return (
    <StageShell
      description="답보다 질문을 먼저 만들어볼까요?"
      onPrimaryAction={handlePrimaryAction}
    >
      <Stack gap={6}>
        <Stack gap={3}>
          {questions.map((q, index) => (
            <Card key={q.id} variant={q.isPriority ? "coach" : "paper"}>
              <Stack gap={2}>
                <p className="text-label font-bold text-text-secondary">
                  질문 {index + 1}
                </p>
                <p className="text-body text-ink">{q.text}</p>
                {q.isPriority ? (
                  <p className="text-caption text-brand-strong">
                    핵심 질문 · {q.priorityReason}
                  </p>
                ) : prioritySelectionId === q.id ? (
                  <Stack gap={2}>
                    <Field id={`priority-reason-${q.id}`} label="이 질문을 고른 이유">
                      <Textarea
                        value={priorityReason}
                        onChange={(e) => setPriorityReason(e.target.value)}
                        autoGrow={false}
                        rows={2}
                      />
                    </Field>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleConfirmPriority(q.id)}
                    >
                      핵심 질문으로 선택
                    </Button>
                  </Stack>
                ) : (
                  <Button
                    type="button"
                    variant="tertiary"
                    onClick={() => setPrioritySelectionId(q.id)}
                  >
                    핵심 질문으로 고르기
                  </Button>
                )}
              </Stack>
            </Card>
          ))}
          <InlineError message={priorityAction.error} />
        </Stack>

        <Field
          id="question-text"
          label="새 질문"
          counter={{ current: text.length, max: INPUT_LIMITS.questionText }}
        >
          <Textarea
            value={text}
            ref={questionInputRef}
            onChange={(e) => setText(e.target.value)}
            autoGrow={false}
            rows={2}
          />
        </Field>
        <Stack direction="row" gap={2}>
          {/* 혼자 하기로 한 세션에서는 AI 도움을 아예 노출하지 않는다 (P1-6). */}
          {hint.canRequest && (
            <Button
              type="button"
              variant="tertiary"
              onClick={() => void hint.request()}
              disabled={hint.pending}
            >
              {hint.pending ? "힌트 요청 중" : hint.error ? "다시 시도" : "힌트 보기"}
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            onClick={handleAdd}
            disabled={addAction.pending}
          >
            {addAction.pending ? "추가하는 중이에요…" : "질문 추가하기"}
          </Button>
        </Stack>
        <InlineError message={addAction.error} />
        {hint.error && (
          // 안심 문장은 실패 사유와 별개로 **항상** 붙인다(DESIGN.md §11 AI Error).
          // 메시지 문자열에 섞어 넣으면 서버가 더 구체적인 사유를 줄 때 사라진다 —
          // 정작 그때가 사용자가 가장 불안한 순간이다. FeedbackStage와 같은 방식이다.
          <p role="alert" className="text-caption font-bold text-danger">
            {hint.error} 작성한 내용은 그대로 있어요.
          </p>
        )}
        {/* 최대 20초를 기다리는 자리다. 버튼 글자만 바뀌면 눌린 건지 멈춘 건지 알 수 없다. */}
        {hint.pending && <CoachLoadingCard label="다음 질문을 정리하고 있어요." />}
        {hint.question && !hint.pending && (
          <Card variant="coach">
            {/* 코치가 준 질문인지, 앱이 준비해둔 질문인지 구분해서 말한다. */}
            {hint.notice && (
              <p className="mb-2 text-caption text-text-secondary">{hint.notice}</p>
            )}
            <p className="text-body-lg text-ink">{hint.question}</p>
          </Card>
        )}

        {questions.length >= 1 && hint.usedHintLevel >= 2 && (
          <Field
            id="questioning-exception"
            label="질문이 더 떠오르지 않는다면, 이유를 적어주세요"
          >
            <Textarea
              value={exceptionReason}
              onChange={(e) => setExceptionReason(e.target.value)}
              autoGrow={false}
              rows={2}
            />
          </Field>
        )}
      </Stack>
    </StageShell>
  );
}
