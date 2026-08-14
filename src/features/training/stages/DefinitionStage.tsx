"use client";

import { useEffect, useState } from "react";
import { Field, Textarea } from "@/components/ui";
import { StageShell } from "../StageShell";
import { useTrainingSession } from "../TrainingSessionProvider";

export function DefinitionStage() {
  const { loadDraft, saveDraft, submitDefinition, advance } = useTrainingSession();
  const [text, setText] = useState("");

  useEffect(() => {
    void loadDraft("definition_text").then((draft) => {
      if (draft) setText(draft);
    });
  }, [loadDraft]);

  async function handlePrimaryAction() {
    if (!text.trim()) {
      return { ok: false as const, message: "현재의 문제 정의를 적어주세요." };
    }
    await submitDefinition({ text, changeReason: undefined });
    return advance();
  }

  return (
    <StageShell
      description="지금까지의 근거로, 현재 가장 타당한 문제 정의를 적어볼까요?"
      primaryLabel="이대로 기록하기"
      onPrimaryAction={handlePrimaryAction}
    >
      <Field
        id="definition-text"
        label="현재의 문제 정의"
        helperText="이 기기에 저장했어요."
      >
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            saveDraft("definition_text", e.target.value);
          }}
          placeholder="누가, 어떤 상황에서, 무엇을 겪고 있는 문제인가요?"
        />
      </Field>
    </StageShell>
  );
}
