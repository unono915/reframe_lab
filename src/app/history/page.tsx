"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, LinkButton, Stack } from "@/components/ui";
import type { TrainingSessionSnapshot, TrainingTemplate } from "@/domain/types";
import { sessionStatusLabel } from "@/domain/training/stages";

/**
 * S-05 History (DESIGN.md §10.5). 월 단위 느슨한 Grouping, 최근순, 날짜·Lens·
 * 관찰 첫 문장·상태를 한 Row에 보여준다. Empty State는 "기록이 없다"에서 끝내지
 * 않고 오늘의 훈련으로 연결한다.
 */
export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<TrainingSessionSnapshot[] | null>(null);
  const [templates, setTemplates] = useState<TrainingTemplate[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/history").then((r) => r.json()) as Promise<{
        sessions: TrainingSessionSnapshot[];
      }>,
      fetch("/api/templates").then((r) => r.json()) as Promise<{ templates: TrainingTemplate[] }>,
    ]).then(([historyBody, templatesBody]) => {
      if (cancelled) return;
      setSessions(historyBody.sessions);
      setTemplates(templatesBody.templates);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const templateById = useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates],
  );

  const groups = useMemo(() => {
    if (!sessions) return [];
    const byMonth = new Map<string, TrainingSessionSnapshot[]>();
    for (const s of sessions) {
      const month = s.session.trainingDate.slice(0, 7); // YYYY-MM
      const list = byMonth.get(month) ?? [];
      list.push(s);
      byMonth.set(month, list);
    }
    return [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [sessions]);

  if (sessions === null) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-5">
        <p className="text-body text-text-secondary">기록을 불러오고 있어요.</p>
      </main>
    );
  }

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-[640px] flex-col gap-8 px-5 py-10">
      <Stack direction="row" justify="between" align="center" gap={2}>
        <h1 className="text-heading-2 font-bold text-ink">기록</h1>
        <Button type="button" variant="tertiary" onClick={() => router.push("/")}>
          홈으로
        </Button>
      </Stack>

      {sessions.length === 0 ? (
        <Stack gap={4}>
          <Card variant="neutral">
            <p className="text-body text-ink">첫 기록은 오늘의 장면에서 시작할 수 있어요.</p>
          </Card>
          <LinkButton href="/training/new" variant="primary" fullWidth>
            오늘의 훈련 시작
          </LinkButton>
        </Stack>
      ) : (
        <Stack gap={6}>
          {groups.map(([month, monthSessions]) => (
            <Stack key={month} gap={3}>
              <p className="text-label font-bold text-text-secondary">
                {month.replace("-", "년 ")}월
              </p>
              <Stack gap={2}>
                {monthSessions.map((s) => {
                  const template = templateById.get(s.session.templateId);
                  return (
                    <Card
                      key={s.session.id}
                      variant="interactive"
                      className="min-h-[72px] w-full"
                      onClick={() => router.push(`/result/${s.session.id}`)}
                    >
                      <Stack gap={1}>
                        <Stack direction="row" justify="between" align="center" gap={2}>
                          <p className="text-caption font-bold text-text-secondary">
                            {s.session.trainingDate}
                          </p>
                          <Badge variant={s.session.status === "completed" ? "brand" : "neutral"}>
                            {sessionStatusLabel(s.session.status)}
                          </Badge>
                        </Stack>
                        {template && (
                          <p className="text-caption text-text-tertiary">{template.title}</p>
                        )}
                        <p className="line-clamp-2 text-body text-ink">
                          {s.observation?.rawText || "(관찰 작성 전)"}
                        </p>
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}
    </main>
  );
}
