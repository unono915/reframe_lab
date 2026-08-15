"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, PageState, Stack } from "@/components/ui";
import type { SessionSummary } from "@/domain/types";
import { computeGrowthMetrics, type GrowthMetrics } from "@/domain/growth/metrics";
import { fetchJson } from "@/lib/fetch-json";

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function todayDateString(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

const MIN_SESSIONS_FOR_RHYTHM = 3;

/** setState를 하지 않는 순수 로더 — 화면 상태 적용은 호출자가 한다. */
function fetchGrowth() {
  return fetchJson<{ sessions: SessionSummary[] }>("/api/history");
}

/**
 * S-07 Growth (DESIGN.md §10.7). 점수화·순위·경쟁 요소를 두지 않는다 — 꾸준함과
 * 재정의·수정 행동만 담담한 문장과 단순 Bar로 보여준다. 계산은 순수 함수
 * (`domain/growth/metrics.ts`)라 저장된 세션에서 매번 다시 계산한다.
 */
export default function GrowthPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<GrowthMetrics | null>(null);
  const [latestSessionId, setLatestSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((result: Awaited<ReturnType<typeof fetchGrowth>>) => {
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const timezone = detectTimezone();
    setMetrics(computeGrowthMetrics(result.data.sessions, todayDateString(timezone)));
    setLatestSessionId(result.data.sessions.find((s) => s.status === "completed")?.id ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchGrowth().then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  function handleRetry() {
    setError(null);
    void fetchGrowth().then(apply);
  }

  if (error) {
    return <PageState status="error" message={error} onRetry={handleRetry} />;
  }
  if (metrics === null) {
    return <PageState status="loading" loadingLabel="기록을 불러오고 있어요." />;
  }

  const maxWeekCount = Math.max(1, ...metrics.recentWeeks.map((w) => w.completedCount));

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-[640px] flex-col gap-8 px-5 py-10">
      <Stack direction="row" justify="between" align="center" gap={2}>
        <h1 className="text-heading-2 font-bold text-ink">성장</h1>
        <Button type="button" variant="tertiary" onClick={() => router.push("/")}>
          홈으로
        </Button>
      </Stack>

      {metrics.totalCompleted < MIN_SESSIONS_FOR_RHYTHM ? (
        <Card variant="neutral">
          <p className="text-body text-ink">
            기록이 몇 번 쌓이면 생각의 변화를 볼 수 있어요. 지금까지 {metrics.totalCompleted}번
            완료했어요.
          </p>
        </Card>
      ) : (
        <Stack gap={6}>
          <Card variant="cream">
            <Stack gap={2}>
              <p className="text-label font-bold text-brand-strong">이번 주</p>
              <p className="text-display-md font-bold text-ink">
                {metrics.completedThisWeek}번
              </p>
              <p className="text-caption text-text-secondary">
                이번 주에 {metrics.completedThisWeek}번의 생각을 기록했어요.
              </p>
            </Stack>
          </Card>

          <Card variant="paper">
            <Stack gap={3}>
              <p className="text-label font-bold text-text-secondary">최근 4주 리듬</p>
              <Stack direction="row" gap={3} align="end">
                {metrics.recentWeeks.map((week) => (
                  <Stack key={week.weekStart} gap={1} align="center">
                    <div
                      className="w-8 rounded-control bg-brand"
                      style={{
                        height: `${Math.max(8, (week.completedCount / maxWeekCount) * 64)}px`,
                      }}
                      aria-hidden="true"
                    />
                    <p className="text-caption text-text-tertiary">{week.completedCount}</p>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Card>

          <Card variant="paper">
            <Stack gap={2}>
              <p className="text-label font-bold text-text-secondary">직접 작성한 재정의</p>
              <p className="text-body-lg text-ink">
                지금까지 {metrics.userAuthoredReframeCount}개의 대안 프레임을 직접 써봤어요.
              </p>
            </Stack>
          </Card>

          <Card variant="paper">
            <Stack gap={2}>
              <p className="text-label font-bold text-text-secondary">정의를 다시 써본 기록</p>
              <p className="text-body-lg text-ink">
                완료한 기록 중 {metrics.revisedDefinitionSessionCount}개에서 처음 정의를 스스로
                고쳐썼어요.
              </p>
            </Stack>
          </Card>

          {latestSessionId && (
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => router.push(`/result/${latestSessionId}`)}
            >
              최근 기록으로 이동
            </Button>
          )}
        </Stack>
      )}
    </main>
  );
}
