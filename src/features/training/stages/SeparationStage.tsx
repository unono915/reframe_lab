"use client";

import { useRef, useState } from "react";
import type { ItemType } from "@/domain/types";
import { Button, Card, Field, InlineError, Stack, Textarea } from "@/components/ui";
import { INPUT_LIMITS } from "@/lib/schemas/stage-input";
import { EXCEPTION_PROMPT_KEYS } from "@/domain/training/requirements";
import { HintPanel } from "../HintPanel";
import { StageShell } from "../StageShell";
import { useTrainingSession } from "../TrainingSessionProvider";
import { useStageHint } from "../useStageHint";
import { useMutationAction } from "../useMutationAction";

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  fact: "확인한 사실",
  interpretation: "내 해석",
  assumption: "아직 가설",
  emotion: "느낀 감정",
  solution: "떠오른 해결책",
};

export function SeparationStage() {
  const {
    snapshot,
    addObservationItem,
    confirmObservationItem,
    submitExceptionReason,
    awaitLatestSnapshot,
    advance,
  } = useTrainingSession();
  const hint = useStageHint("separation");
  const [text, setText] = useState("");
  const [type, setType] = useState<ItemType>("fact");
  const [exceptionReason, setExceptionReason] = useState("");
  const addAction = useMutationAction();
  const itemInputRef = useRef<HTMLTextAreaElement>(null);
  const confirmAction = useMutationAction();

  if (!snapshot) return null;
  const items = snapshot.observationItems;
  const confirmedCount = items.filter((i) => i.userConfirmed).length;

  async function handleAdd() {
    if (!text.trim()) return;
    // 먼저 지우고 나서 제출한다 — 반대로 하면 addObservationItem이 끝나길 기다리는
    // 동안 사용자가 다음 항목을 입력했을 때, 뒤늦게 실행되는 setText("")가 방금 입력한
    // 값을 지워버린다(연속 추가 시 실제로 재현됨).
    const submitted = text;
    setText("");
    // 다음 항목을 바로 이어 쓸 수 있게 입력창으로 focus를 돌린다. **await 앞에서**
    // 부르는 것이 중요하다 — iOS는 사용자 제스처가 살아 있는 동안에만 키보드를
    // 열어주므로, 저장을 기다린 뒤에 부르면 focus만 가고 키보드는 닫힌 채로 남는다.
    itemInputRef.current?.focus();
    // 저장이 실패하면 방금 지운 입력을 되돌린다 — 그러지 않으면 사용자가 쓴 문장이
    // 서버에도 화면에도 남지 않는다(원칙 7).
    await addAction.run(
      () => addObservationItem({ text: submitted, type }),
      () => setText(submitted),
    );
  }

  async function handlePrimaryAction() {
    // 방금 클릭한 "확인" 토글이 아직 큐에서 처리 중일 수 있으므로, 판단 직전에
    // 큐가 비워질 때까지 기다려 최신 확인 개수를 다시 센다(원칙 7과 같은 종류의 버그).
    const latest = await awaitLatestSnapshot();
    const latestConfirmedCount =
      latest?.observationItems.filter((i) => i.userConfirmed).length ?? confirmedCount;
    if (latestConfirmedCount === 0) {
      if (!exceptionReason.trim()) {
        return {
          ok: false as const,
          message: "확인한 사실이 부족하면 그 이유를 남겨주세요.",
        };
      }
      await submitExceptionReason(EXCEPTION_PROMPT_KEYS.separation, exceptionReason);
    }
    return advance();
  }

  return (
    <StageShell
      description="실제로 본 것과 그렇게 해석한 것을 나누어볼까요?"
      onPrimaryAction={handlePrimaryAction}
    >
      <Stack gap={6}>
        {snapshot.observation && (
          <Card variant="paper">
            <p className="text-label font-bold text-brand-strong">내가 쓴 문장</p>
            <p className="text-body text-ink">{snapshot.observation.rawText}</p>
          </Card>
        )}

        <Stack gap={3}>
          {items.map((item) => (
            <Card key={item.id} variant={item.userConfirmed ? "cream" : "neutral"}>
              <Stack direction="row" justify="between" align="center" gap={3}>
                <Stack gap={1}>
                  <p className="text-caption font-bold text-text-secondary">
                    {ITEM_TYPE_LABELS[item.type]}
                  </p>
                  <p className="text-body text-ink">{item.text}</p>
                </Stack>
                <Button
                  type="button"
                  variant={item.userConfirmed ? "secondary" : "primary"}
                  onClick={() =>
                    void confirmAction.run(() =>
                      confirmObservationItem(item.id, !item.userConfirmed),
                    )
                  }
                >
                  {item.userConfirmed ? "확인됨" : "확인"}
                </Button>
              </Stack>
            </Card>
          ))}
          <InlineError message={confirmAction.error} />
        </Stack>

        <Field
          id="separation-item-text"
          label="추가할 항목"
          counter={{ current: text.length, max: INPUT_LIMITS.observationItemText }}
        >
          <Textarea
            ref={itemInputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoGrow={false}
            rows={2}
          />
        </Field>
        <Stack direction="row" gap={2} className="flex-wrap">
          {(Object.keys(ITEM_TYPE_LABELS) as ItemType[]).map((t) => (
            <Button
              key={t}
              type="button"
              variant={type === t ? "primary" : "secondary"}
              onClick={() => setType(t)}
            >
              {ITEM_TYPE_LABELS[t]}
            </Button>
          ))}
        </Stack>
        <Button
          type="button"
          variant="tertiary"
          onClick={handleAdd}
          disabled={addAction.pending}
        >
          {addAction.pending ? "추가하는 중이에요…" : "항목 추가하기"}
        </Button>
        <InlineError message={addAction.error} />

        {/*
          분류 후보를 제안하되 단정하지 않는다(DEVELOPMENT_PLAN §8.2). 사용자가 항목을
          하나라도 쓴 뒤에만 열린다 — 빈 화면에 대고 AI를 부르지 않는다(원칙 1).
        */}
        <HintPanel hint={hint} label="분류가 헷갈리면 질문 하나 받기" />

        {confirmedCount === 0 && (
          <Field
            id="separation-exception"
            label="확인된 사실이 아직 부족하다면, 이유를 적어주세요"
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
