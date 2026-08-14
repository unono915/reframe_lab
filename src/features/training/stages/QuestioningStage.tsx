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
    advance,
  } = useTrainingSession();
  const [text, setText] = useState("");
  const [hintLevel, setHintLevel] = useState<HintLevel>(0);
  const [hintText, setHintText] = useState<string | null>(null);
  const [prioritySelectionId, setPrioritySelectionId] = useState<string | null>(null);
  const [priorityReason, setPriorityReason] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");

  if (!snapshot) return null;
  const questions = snapshot.questions.filter((q) => q.authorType === "user");
  const hasPriority = questions.some((q) => q.isPriority);

  async function handleAdd() {
    if (!text.trim()) return;
    await addQuestion({ text }, hintLevel);
    setText("");
    setHintText(null);
  }

  async function handleHint() {
    const question = await requestHint(hintLevel);
    setHintText(question);
    setHintLevel((level) => (level < 2 ? ((level + 1) as HintLevel) : level));
  }

  async function handleConfirmPriority(questionId: string) {
    if (!priorityReason.trim()) return;
    await markPriorityQuestion(questionId, priorityReason);
    setPrioritySelectionId(null);
    setPriorityReason("");
  }

  async function handlePrimaryAction() {
    if (questions.length < 3 || !hasPriority) {
      if (questions.length >= 1 && hintLevel >= 2 && exceptionReason.trim()) {
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
          <Button type="button" variant="tertiary" onClick={handleHint}>
            힌트 보기
          </Button>
          <Button type="button" variant="primary" onClick={handleAdd}>
            질문 추가하기
          </Button>
        </Stack>
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
