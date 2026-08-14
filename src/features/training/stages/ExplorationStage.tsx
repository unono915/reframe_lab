"use client";

import { useEffect, useState } from "react";
import { Field, Stack, Textarea } from "@/components/ui";
import { StageShell } from "../StageShell";
import { useTrainingSession } from "../TrainingSessionProvider";

const PROMPTS: {
  key: "affected_user" | "context" | "impact" | "unknown";
  label: string;
}[] = [
  { key: "affected_user", label: "가장 직접적인 영향을 받는 사람은 누구인가요?" },
  { key: "context", label: "이 문제는 어떤 상황·맥락에서 일어나나요?" },
  { key: "impact", label: "이로 인해 무엇이 어렵거나 달라졌나요?" },
  {
    key: "unknown",
    label: "아직 확실히 모르는 부분은 무엇인가요? ('모르겠다'도 괜찮아요)",
  },
];

export function ExplorationStage() {
  const { loadDraft, saveDraft, addExplorationResponse, advance } = useTrainingSession();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(PROMPTS.map((p) => loadDraft(p.key))).then((drafts) => {
      if (cancelled) return;
      const loaded: Record<string, string> = {};
      PROMPTS.forEach((p, i) => {
        const draft = drafts[i];
        if (draft) loaded[p.key] = draft;
      });
      setValues((prev) => ({ ...loaded, ...prev }));
    });
    return () => {
      cancelled = true;
    };
  }, [loadDraft]);

  async function handlePrimaryAction() {
    const missing = PROMPTS.filter((p) => !values[p.key]?.trim());
    if (missing.length > 0) {
      return { ok: false as const, message: "네 가지 질문에 모두 답해주세요." };
    }
    for (const p of PROMPTS) {
      await addExplorationResponse(p.key, values[p.key] ?? "");
    }
    return advance();
  }

  return (
    <StageShell
      description="사용자, 상황, 영향과 아직 모르는 것을 하나씩 살펴볼까요?"
      onPrimaryAction={handlePrimaryAction}
    >
      <Stack gap={6}>
        {PROMPTS.map((p) => (
          <Field key={p.key} id={`exploration-${p.key}`} label={p.label}>
            <Textarea
              value={values[p.key] ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                setValues((prev) => ({ ...prev, [p.key]: value }));
                saveDraft(p.key, value);
              }}
              autoGrow={false}
              rows={3}
            />
          </Field>
        ))}
      </Stack>
    </StageShell>
  );
}
