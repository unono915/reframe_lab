"use client";

import { useEffect, useState } from "react";
import { Field, Stack, Textarea } from "@/components/ui";
import { INPUT_LIMITS } from "@/lib/schemas/stage-input";
import { StageShell } from "../StageShell";
import { useTrainingSession } from "../TrainingSessionProvider";

export function DefinitionStage() {
  const { loadDraft, saveDraft, submitDefinition, advance } = useTrainingSession();
  /*
    이 단계에는 힌트 버튼을 두지 않는다.

    서버의 User-first gate는 정의 단계에서 **v1이 이미 저장돼 있을 것**을 요구한다.
    그런데 v1은 "이대로 기록하기"를 눌러야 생기고, 그 순간 다음 단계로 넘어간다 —
    즉 이 화면에 머무는 동안에는 조건이 절대 충족되지 않는다.

    조건을 맞추려고 힌트가 v1을 대신 저장하면 더 나쁘다. 그 뒤 사용자가 문장을 고쳐
    "기록하기"를 누르면 v2가 되고, 기록 화면은 "처음 생각과 지금 생각"을 나란히 보여준다
    — 생각을 고친 적이 없는데 고친 것처럼 남는다.

    DEVELOPMENT_PLAN §8.2가 이 단계에 배정한 "누락 요소를 질문"은 바로 다음 단계의 AI
    피드백("더 살펴볼 점")이 그대로 수행한다. 없는 기능이 아니라 자리가 다음 칸이다.
  */

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
      <Stack gap={6}>
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
      </Stack>
    </StageShell>
  );
}
