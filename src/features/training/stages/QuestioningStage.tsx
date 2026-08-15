"use client";

import { useState } from "react";
import type { HintLevel } from "@/domain/types";
import { Button, Card, Field, Stack, Textarea } from "@/components/ui";
import { EXCEPTION_PROMPT_KEYS } from "@/domain/training/requirements";
import { StageShell } from "../StageShell";
import { useTrainingSession } from "../TrainingSessionProvider";

export function QuestioningStage() {
  const {
    snapshot,
    addQuestion,
    markPriorityQuestion,
    requestHint,
    submitExceptionReason,
    awaitLatestSnapshot,
    advance,
  } = useTrainingSession();
  const [text, setText] = useState("");
  const [hintLevel, setHintLevel] = useState<HintLevel>(0);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintPending, setHintPending] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);
  const [prioritySelectionId, setPrioritySelectionId] = useState<string | null>(null);
  const [priorityReason, setPriorityReason] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");

  if (!snapshot) return null;
  const questions = snapshot.questions.filter((q) => q.authorType === "user");

  async function handleAdd() {
    if (!text.trim()) return;
    // 먼저 지우고 제출한다 — await 이후에 지우면 저장을 기다리는 동안 사용자가 다음
    // 질문을 입력했을 때 뒤늦은 초기화가 그 입력을 지워버린다(실제로 재현됨: 연속으로
    // 질문 3개를 빠르게 추가하면 그중 하나가 조용히 사라졌다).
    const submitted = text;
    const submittedHintLevel = hintLevel;
    setText("");
    setHintText(null);
    await addQuestion({ text: submitted }, submittedHintLevel);
  }

  async function handleHint() {
    setHintPending(true);
    setHintError(null);
    const result = await requestHint(hintLevel);
    setHintPending(false);
    if (!result.ok) {
      setHintError(result.message);
      return;
    }
    setHintText(result.question);
    setHintLevel((level) => (level < 2 ? ((level + 1) as HintLevel) : level));
  }

  async function handleConfirmPriority(questionId: string) {
    if (!priorityReason.trim()) return;
    const submitted = priorityReason;
    setPrioritySelectionId(null);
    setPriorityReason("");
    await markPriorityQuestion(questionId, submitted);
  }

  async function handlePrimaryAction() {
    // 직전 질문 추가·핵심 질문 선택이 아직 큐에서 처리 중일 수 있으므로, 판단
    // 직전에 큐가 비워질 때까지 기다려 최신 상태로 다시 센다(원칙 7과 같은 종류의 버그).
    const latest = await awaitLatestSnapshot();
    const latestQuestions =
      latest?.questions.filter((q) => q.authorType === "user") ?? questions;
    const latestHasPriority = latestQuestions.some((q) => q.isPriority);
    if (latestQuestions.length < 3 || !latestHasPriority) {
      if (latestQuestions.length >= 1 && hintLevel >= 2 && exceptionReason.trim()) {
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
        </Stack>

        <Field id="question-text" label="새 질문">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoGrow={false}
            rows={2}
          />
        </Field>
        <Stack direction="row" gap={2}>
          <Button type="button" variant="tertiary" onClick={handleHint} disabled={hintPending}>
            {hintPending ? "힌트 요청 중" : hintError ? "다시 시도" : "힌트 보기"}
          </Button>
          <Button type="button" variant="primary" onClick={handleAdd}>
            질문 추가하기
          </Button>
        </Stack>
        {hintError && (
          <p role="alert" className="text-caption font-bold text-danger">
            {hintError}
          </p>
        )}
        {hintText && (
          <Card variant="coach">
            <p className="text-body-lg text-ink">{hintText}</p>
          </Card>
        )}

        {questions.length >= 1 && hintLevel >= 2 && (
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
