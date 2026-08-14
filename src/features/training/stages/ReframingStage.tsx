"use client";

import { useState } from "react";
import type { PerspectiveLens } from "@/domain/types";
import { Button, Card, Field, Stack, Textarea } from "@/components/ui";
import { EXCEPTION_PROMPT_KEYS } from "@/domain/training/requirements";
import { StageShell } from "../StageShell";
import { useTrainingSession } from "../TrainingSessionProvider";

const LENS_LABELS: Record<PerspectiveLens, string> = {
  stakeholder: "사람 바꾸기",
  timeframe: "시간 앞뒤",
  scope: "범위 넓히기",
  structure: "구조 보기",
  counter_example: "반대 사례",
  causality: "원인 다시 보기",
  most_disadvantaged: "가장 불리한 입장",
};

export function ReframingStage() {
  const { snapshot, addPerspective, addReframe, submitExceptionReason, advance } =
    useTrainingSession();
  const [perspectiveLens, setPerspectiveLens] = useState<PerspectiveLens>("stakeholder");
  const [perspectiveText, setPerspectiveText] = useState("");
  const [reframeText, setReframeText] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");

  if (!snapshot) return null;
  const reframes = snapshot.reframes.filter((r) => r.authorType === "user");

  // 두 함수 모두 제출 전에 먼저 입력창을 비운다 — await 이후에 비우면, 저장이 끝나길
  // 기다리는 동안 사용자가 다음 값을 입력했을 때 뒤늦은 초기화가 그 값을 지워버린다.
  async function handleAddPerspective() {
    if (!perspectiveText.trim()) return;
    const submitted = perspectiveText;
    setPerspectiveText("");
    await addPerspective({ lensType: perspectiveLens, content: submitted });
  }

  async function handleAddReframe() {
    if (!reframeText.trim()) return;
    const submitted = reframeText;
    setReframeText("");
    await addReframe({ text: submitted }, 0);
  }

  async function handlePrimaryAction() {
    if (reframes.length < 2) {
      if (reframes.length >= 1 && exceptionReason.trim()) {
        await submitExceptionReason(EXCEPTION_PROMPT_KEYS.reframing, exceptionReason);
      } else {
        return { ok: false as const, message: "다른 프레임을 2개 이상 적어주세요." };
      }
    }
    return advance();
  }

  return (
    <StageShell
      description="다른 렌즈로 이 문제를 다시 봐볼까요?"
      onPrimaryAction={handlePrimaryAction}
    >
      <Stack gap={6}>
        <Stack gap={3}>
          <p className="text-heading-3 font-bold text-ink">1. 관점 탐색</p>
          <Stack direction="row" gap={2} className="flex-wrap">
            {(Object.keys(LENS_LABELS) as PerspectiveLens[]).map((lens) => (
              <Button
                key={lens}
                type="button"
                variant={perspectiveLens === lens ? "primary" : "secondary"}
                onClick={() => setPerspectiveLens(lens)}
              >
                {LENS_LABELS[lens]}
              </Button>
            ))}
          </Stack>
          <Field id="perspective-content" label="이 렌즈로 보니 새로 보이는 것">
            <Textarea
              value={perspectiveText}
              onChange={(e) => setPerspectiveText(e.target.value)}
              autoGrow={false}
              rows={2}
            />
          </Field>
          <Button type="button" variant="tertiary" onClick={handleAddPerspective}>
            발견한 내용 추가하기
          </Button>
          {snapshot.perspectives.map((p) => (
            <Card key={p.id} variant="cream">
              <p className="text-caption font-bold text-brand-strong">
                {LENS_LABELS[p.lensType]}
              </p>
              <p className="text-body text-ink">{p.content}</p>
            </Card>
          ))}
        </Stack>

        <Stack gap={3}>
          <p className="text-heading-3 font-bold text-ink">2. 다른 문제 프레임 작성</p>
          {reframes.map((r, i) => (
            <Card key={r.id} variant="paper">
              <p className="text-label font-bold text-text-secondary">
                다른 관점 {i + 1}
              </p>
              <p className="text-body text-ink">{r.text}</p>
            </Card>
          ))}
          <Field id="reframe-text" label="대안 문제 프레임">
            <Textarea
              value={reframeText}
              onChange={(e) => setReframeText(e.target.value)}
              autoGrow={false}
              rows={2}
            />
          </Field>
          <Button type="button" variant="tertiary" onClick={handleAddReframe}>
            프레임 추가하기
          </Button>
        </Stack>

        {reframes.length === 1 && (
          <Field id="reframe-exception" label="더 떠오르지 않는다면, 이유를 적어주세요">
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
