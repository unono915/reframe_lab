"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, LinkButton, PageState, Button, Stack } from "@/components/ui";
import type { SessionSummary, TrainingTemplate } from "@/domain/types";
import { sessionStatusLabel } from "@/domain/training/stages";
import { formatMonthLabel, formatRecordDate } from "@/domain/format-date";
import { fetchJson } from "@/lib/fetch-json";

/**
 * S-05 History (DESIGN.md §10.5). 월 단위 느슨한 Grouping, 최근순, 날짜·Lens·
 * 관찰 첫 문장·상태를 한 Row에 보여준다. Empty State는 "기록이 없다"에서 끝내지
 * 않고 오늘의 훈련으로 연결한다.
 */
/** setState를 하지 않는 순수 로더 — 화면 상태 적용은 호출자가 한다. */
async function fetchHistory() {
  const [history, templates] = await Promise.all([
    fetchJson<{ sessions: SessionSummary[] }>("/api/history"),
    fetchJson<{ templates: TrainingTemplate[] }>("/api/templates"),
  ]);
  return { history, templates };
}

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [templates, setTemplates] = useState<TrainingTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(({ history, templates }: Awaited<ReturnType<typeof fetchHistory>>) => {
    if (!history.ok) {
      setError(history.message);
      return;
    }
    setSessions(history.data.sessions);
    // 템플릿은 보조 정보(렌즈 이름)라 실패해도 목록 자체는 보여준다.
    if (templates.ok) setTemplates(templates.data.templates);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchHistory().then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  function handleRetry() {
    setError(null);
    void fetchHistory().then(apply);
  }

  const templateById = useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates],
  );

  const groups = useMemo(() => {
    if (!sessions) return [];
    const byMonth = new Map<string, SessionSummary[]>();
    for (const s of sessions) {
      const month = s.trainingDate.slice(0, 7); // YYYY-MM
      const list = byMonth.get(month) ?? [];
      list.push(s);
      byMonth.set(month, list);
    }
    return [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [sessions]);

  if (error) {
    return <PageState status="error" message={error} onRetry={handleRetry} />;
  }
  if (sessions === null) {
    return <PageState status="loading" loadingLabel="기록을 불러오고 있어요." />;
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
              <h2 className="text-label font-bold text-text-secondary">
                {formatMonthLabel(month)}
              </h2>
              <Stack gap={2}>
                {monthSessions.map((s) => {
                  const template = templateById.get(s.templateId);
                  return (
                    <Card
                      key={s.id}
                      variant="interactive"
                      className="min-h-[72px] w-full"
                      onClick={() => router.push(`/result/${s.id}`)}
                    >
                      <Stack gap={1}>
                        <Stack direction="row" justify="between" align="center" gap={2}>
                          <p className="text-caption font-bold text-text-secondary">
                            {formatRecordDate(s.trainingDate)}
                          </p>
                          <Badge variant={s.status === "completed" ? "brand" : "neutral"}>
                            {sessionStatusLabel(s.status)}
                          </Badge>
                        </Stack>
                        {template && (
                          <p className="text-caption text-text-tertiary">{template.title}</p>
                        )}
                        <p className="line-clamp-2 text-body text-ink">
                          {s.observationText || "(관찰 작성 전)"}
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
