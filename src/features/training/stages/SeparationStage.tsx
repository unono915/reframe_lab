"use client";

import { useState } from "react";
import type { ItemType } from "@/domain/types";
import { Button, Card, Field, Stack, Textarea } from "@/components/ui";
import { EXCEPTION_PROMPT_KEYS } from "@/domain/training/requirements";
import { StageShell } from "../StageShell";
import { useTrainingSession } from "../TrainingSessionProvider";

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
  const [text, setText] = useState("");
  const [type, setType] = useState<ItemType>("fact");
  const [exceptionReason, setExceptionReason] = useState("");

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
    await addObservationItem({ text: submitted, type });
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
                  onClick={() => confirmObservationItem(item.id, !item.userConfirmed)}
                >
                  {item.userConfirmed ? "확인됨" : "확인"}
                </Button>
              </Stack>
            </Card>
          ))}
        </Stack>

        <Field id="separation-item-text" label="추가할 항목">
          <Textarea
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
        <Button type="button" variant="tertiary" onClick={handleAdd}>
          항목 추가하기
        </Button>

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
