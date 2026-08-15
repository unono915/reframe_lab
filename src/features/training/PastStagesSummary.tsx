"use client";

import { useState } from "react";
import type { Stage, TrainingSessionSnapshot } from "@/domain/types";
import { Badge, Button, Card, Stack, Textarea } from "@/components/ui";
import { STAGE_ORDER, stageIndex, stageLabel } from "@/domain/training/stages";
import { useTrainingSession } from "./TrainingSessionProvider";

/**
 * DESIGN.md §6.5: "이전 답변은 접힌 Summary로 확인하며, 수정 시 해당 단계부터
 * 다시 진행한다는 점을 명확히 안내한다." 지금 단계보다 앞선 단계만 대상이다 —
 * 앞으로 올 단계는 아직 아무것도 없으니 보여줄 게 없다.
 *
 * "수정"은 observation·definition 두 단계에서만 지원한다 — 이 둘만 "다시 쓰는"
 * 단일 텍스트라 되돌아가 고치는 것이 자연스럽다. separation/questioning/
 * exploration/reframing은 여러 항목을 누적하는 방식이라 "이전으로 돌아가 수정"
 * 보다는 그대로 보존하는 기록으로 취급한다 — 이 범위는 PRD가 강제하지 않는다.
 */
export function PastStagesSummary({ currentStage }: { currentStage: Stage }) {
  const { snapshot } = useTrainingSession();
  const currentIndex = stageIndex(currentStage);
  if (!snapshot || currentIndex <= 0) return null;

  const pastStages = STAGE_ORDER.slice(0, currentIndex);

  return (
    <Stack gap={3}>
      <p className="text-label font-bold text-text-secondary">지난 단계</p>
      {pastStages.map((stage) => (
        <PastStageRow key={stage} stage={stage} snapshot={snapshot} />
      ))}
    </Stack>
  );
}

function summarize(stage: Stage, snapshot: TrainingSessionSnapshot): string {
  switch (stage) {
    case "observation":
      return snapshot.observation?.rawText || "(작성 안 됨)";
    case "separation": {
      const confirmed = snapshot.observationItems.filter((i) => i.userConfirmed);
      return confirmed.length > 0
        ? `확인한 사실 등 ${confirmed.length}개`
        : "(확인된 항목 없음)";
    }
    case "questioning": {
      const priority = snapshot.questions.find((q) => q.isPriority);
      return priority ? `핵심 질문: ${priority.text}` : `질문 ${snapshot.questions.length}개`;
    }
    case "exploration": {
      const answered = snapshot.stageResponses.filter((r) => r.stage === "exploration");
      return `${answered.length}개 질문에 답변`;
    }
    case "reframing": {
      const reframes = snapshot.reframes.filter((r) => r.authorType === "user");
      return reframes[0] ? `${reframes[0].text}${reframes.length > 1 ? ` 외 ${reframes.length - 1}개` : ""}` : "(작성 안 됨)";
    }
    case "definition": {
      const latest = [...snapshot.problemDefinitionVersions].sort(
        (a, b) => b.versionNumber - a.versionNumber,
      )[0];
      return latest ? latest.text : "(작성 안 됨)";
    }
    default:
      return "";
  }
}

const EDITABLE_STAGES: Stage[] = ["observation", "definition"];

function PastStageRow({
  stage,
  snapshot,
}: {
  stage: Stage;
  snapshot: TrainingSessionSnapshot;
}) {
  const { submitObservation, submitDefinition } = useTrainingSession();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const initialText =
    stage === "observation"
      ? (snapshot.observation?.rawText ?? "")
      : ([...snapshot.problemDefinitionVersions].sort(
          (a, b) => b.versionNumber - a.versionNumber,
        )[0]?.text ?? "");
  const [text, setText] = useState(initialText);
  const editable = EDITABLE_STAGES.includes(stage);

  async function handleSave() {
    if (!text.trim()) return;
    if (stage === "observation") {
      await submitObservation({ rawText: text, contextWhen: undefined, contextWhere: undefined });
    } else if (stage === "definition") {
      await submitDefinition({ text, changeReason: "이전 단계로 돌아가 수정함" });
    }
    setEditing(false);
    setSaved(true);
  }

  return (
    <Card variant="neutral">
      <Stack gap={2}>
        <Stack direction="row" justify="between" align="center" gap={2}>
          <p className="text-label font-bold text-text-secondary">{stageLabel(stage)}</p>
          {editable && !editing && (
            <Button type="button" variant="tertiary" onClick={() => setEditing(true)}>
              수정하기
            </Button>
          )}
        </Stack>

        {saved && (
          <Badge variant="stale">
            수정됨 — 이후 단계에서 나온 AI 결과는 다시 확인해야 해요
          </Badge>
        )}

        {editing ? (
          <Stack gap={2}>
            <p className="text-caption text-text-secondary">
              수정하면 이 단계 이후에 나온 AI 질문·피드백은 다시 확인이 필요해요. 이미
              작성한 다음 단계 내용은 그대로 남아있어요.
            </p>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoGrow={false}
              rows={3}
            />
            <Stack direction="row" gap={2}>
              <Button type="button" variant="primary" onClick={handleSave}>
                저장하기
              </Button>
              <Button
                type="button"
                variant="tertiary"
                onClick={() => {
                  setText(initialText);
                  setEditing(false);
                }}
              >
                취소
              </Button>
            </Stack>
          </Stack>
        ) : (
          <p className="text-body text-ink">{summarize(stage, snapshot)}</p>
        )}
      </Stack>
    </Card>
  );
}
