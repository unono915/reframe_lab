"use client";

import { useEffect, useState } from "react";
import { Button, Card, Field, Stack, Textarea } from "@/components/ui";
import { EXCEPTION_PROMPT_KEYS } from "@/domain/training/requirements";
import { StageShell } from "../StageShell";
import { useTrainingSession } from "../TrainingSessionProvider";

export function ObservationStage() {
  const {
    template,
    saveDraft,
    loadDraft,
    submitObservation,
    advance,
    submitExceptionReason,
  } = useTrainingSession();
  const [rawText, setRawText] = useState("");
  const [showException, setShowException] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");

  useEffect(() => {
    void loadDraft("raw_text").then((draft) => {
      if (draft) setRawText(draft);
    });
  }, [loadDraft]);

  async function handlePrimaryAction() {
    if (showException) {
      if (!exceptionReason.trim()) {
        return { ok: false as const, message: "사유를 남겨주세요." };
      }
      await submitExceptionReason(EXCEPTION_PROMPT_KEYS.observation, exceptionReason);
    } else {
      if (!rawText.trim()) {
        return { ok: false as const, message: "관찰한 장면을 한 문장 이상 남겨주세요." };
      }
      await submitObservation({
        rawText,
        contextWhen: undefined,
        contextWhere: undefined,
      });
    }
    return advance();
  }

  return (
    <StageShell
      description="오늘 당연하게 지나친 장면이 있었나요?"
      onPrimaryAction={handlePrimaryAction}
    >
      <Stack gap={6}>
        {template && (
          <Card variant="daily">
            <Stack gap={3}>
              <p className="text-label font-bold text-brand-strong">오늘 다시 볼 장면</p>
              <p className="text-display-md font-bold text-ink">{template.prompt}</p>
            </Stack>
          </Card>
        )}

        {!showException ? (
          <Field
            id="observation-raw-text"
            label="관찰한 장면"
            helperText="이 기기에 저장했어요."
          >
            <Textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                saveDraft("raw_text", e.target.value);
              }}
              placeholder="언제, 어디서, 무엇이 있었는지 적어보세요"
            />
          </Field>
        ) : (
          <Field id="observation-exception" label="지금은 이 이상 구체화하기 어려운 이유">
            <Textarea
              value={exceptionReason}
              onChange={(e) => setExceptionReason(e.target.value)}
              autoGrow={false}
              rows={3}
            />
          </Field>
        )}

        <Button
          type="button"
          variant="tertiary"
          onClick={() => setShowException((v) => !v)}
        >
          {showException ? "다시 관찰 작성으로" : "지금은 구체화하기 어려워요"}
        </Button>
      </Stack>
    </StageShell>
  );
}
