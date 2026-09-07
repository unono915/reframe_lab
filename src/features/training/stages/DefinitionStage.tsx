"use client";

import { useEffect, useState } from "react";
import { Field, Textarea } from "@/components/ui";
import { INPUT_LIMITS } from "@/lib/schemas/stage-input";
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
        /*
          DESIGN.md §11 "Draft Saved"는 초안이 **저장됐을 때** 보여주는 안내다.
          늘 띄워두면 아무것도 쓰지 않은 빈 입력창 아래에서도 "저장했어요"라고
          말하게 된다 — 사실이 아니고, 정작 진짜 저장됐을 때의 안심 효과도 사라진다.
          쓴 내용이 있을 때만 보여준다(디바운스 500ms 뒤 실제로 기록된다).
        */
        helperText={text.trim() ? "이 기기에 저장했어요." : undefined}

        counter={{ current: text.length, max: INPUT_LIMITS.definitionText }}
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
