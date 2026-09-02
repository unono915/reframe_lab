"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, cn, PageState, Stack } from "@/components/ui";
import type { SessionSummary } from "@/domain/types";
import {
  computeGrowthMetrics,
  type GrowthMetrics,
  type QualityTrendPoint,
  type TrendShift,
} from "@/domain/growth/metrics";
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
/** Dot 추이는 최근 것만 보여준다 — 수십 개가 늘어서면 변화를 읽을 수 없다. */
const MAX_TREND_DOTS = 12;
const TOTAL_DIMENSIONS = 6;
/** `recentWeeks`는 항상 오래된 주 → 이번 주 순서로 4개다(metrics.ts). */
const WEEK_LABELS = ["3주 전", "2주 전", "지난주", "이번 주"] as const;
/** 막대 최대 높이(px). 이상치가 있어도 카드를 넘지 않게 하는 상한이다. */
const BAR_MAX_HEIGHT = 56;

function fetchGrowth() {
  return fetchJson<{ sessions: SessionSummary[] }>("/api/history");
}

/**
 * S-07 Growth (DESIGN.md §10.7).
 *
 * 화면의 순서가 곧 주장이다. 예전에는 "이번 주 몇 번"이 맨 위였는데, 그건 성실함이지
 * 향상이 아니다 — PRD §2.4가 스스로 "단순 훈련 개수를 향상 지표로 쓰지 않는다"고
 * 적어두었는데 화면은 정확히 그것만 보여주고 있었다.
 *
 * 이제 **생각이 달라진 지점**이 먼저 오고, 꾸준함은 그 아래 보조 정보로 내려간다.
 * 점수·순위·종합 등급은 여전히 만들지 않는다(원칙 8) — 보여주는 것은 방향과 문장뿐이다.
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

  /*
    한 주에 몰린 이상치(예: 과거 기록 이관으로 한 주에 35번)가 있으면, 최댓값을
    기준으로 잡을 때 나머지 주가 전부 1px로 뭉개져 리듬을 읽을 수 없다.
    두 번째로 큰 값을 기준으로 삼고 넘치는 막대는 **높이를 잘라서** 표시한다 —
    기준만 바꾸고 높이를 제한하지 않으면 막대가 카드 밖으로 폭주한다(실제로 겪었다).
  */
  const sortedCounts = [...metrics.recentWeeks.map((w) => w.completedCount)].sort(
    (a, b) => b - a,
  );
  const maxWeekCount = Math.max(1, sortedCounts[1] ?? sortedCounts[0] ?? 0);

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
        <Stack gap={8}>
          <QualitySection metrics={metrics} />
          <RhythmSection metrics={metrics} maxWeekCount={maxWeekCount} />

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

/** 향상을 말하는 영역. 아무 신호도 없으면 없다고 정직하게 말한다. */
function QualitySection({ metrics }: { metrics: GrowthMetrics }) {
  const hasAnySignal =
    metrics.coverageShift !== null ||
    metrics.calibrationTrend.length > 0 ||
    metrics.strongHintShift !== null ||
    metrics.completedWithoutAiCount > 0;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-heading-3 font-bold text-ink">생각이 달라진 지점</h2>
        <p className="mt-1 text-caption text-text-secondary">
          몇 번 했는지가 아니라, 무엇이 달라졌는지를 봅니다.
        </p>
      </div>

      {!hasAnySignal ? (
        <Card variant="neutral">
          <p className="text-body text-ink">
            AI 피드백을 받은 기록이 네 번 이상 쌓이면 변화를 견줘볼 수 있어요.
          </p>
          <p className="mt-2 text-caption text-text-secondary">
            지금은 기록을 모으는 중이에요. 비교할 것이 없을 때 억지로 보여주지 않아요.
          </p>
        </Card>
      ) : (
        <Stack gap={4}>
          {metrics.coverageShift && (
            <Card variant="cream">
              <Stack gap={3}>
                <p className="text-label font-bold text-brand-strong">
                  정의에 드러나는 것이 늘었는지
                </p>
                <DotTrend points={metrics.coverageTrend} max={1} />
                <p className="text-body text-ink">{coverageSentence(metrics.coverageShift)}</p>
              </Stack>
            </Card>
          )}

          {metrics.calibrationTrend.length > 0 && (
            <Card variant="paper">
              <Stack gap={3}>
                <p className="text-label font-bold text-text-secondary">
                  내 판단과 코치 판단의 거리
                </p>
                <p className="text-body text-ink">
                  {calibrationSentence(metrics.calibrationTrend)}
                </p>
                <p className="text-caption text-text-tertiary">
                  스스로 드러났다고 본 항목 중, 코치가 문장에서 근거를 찾지 못한 개수예요.
                  줄어들수록 내 글을 더 정확히 보고 있다는 뜻이에요.
                </p>
              </Stack>
            </Card>
          )}

          {metrics.strongHintShift && (
            <Card variant="paper">
              <Stack gap={2}>
                <p className="text-label font-bold text-text-secondary">힌트에 기대는 정도</p>
                <p className="text-body text-ink">{hintSentence(metrics.strongHintShift)}</p>
              </Stack>
            </Card>
          )}

          {metrics.completedWithoutAiCount > 0 && (
            <Card variant="paper">
              <Stack gap={2}>
                <p className="text-label font-bold text-text-secondary">혼자 해낸 기록</p>
                <p className="text-body text-ink">
                  AI 도움 없이 끝까지 간 기록이 {metrics.completedWithoutAiCount}번 있어요.
                </p>
                <p className="text-caption text-text-tertiary">
                  이 앱의 목표는 AI가 있을 때 잘 쓰는 것이 아니라, 없을 때도 스스로 보는
                  거예요.
                </p>
              </Stack>
            </Card>
          )}
        </Stack>
      )}
    </section>
  );
}

/** 꾸준함. 향상 지표가 아니라 습관 정보라 아래로 내려왔다. */
function RhythmSection({
  metrics,
  maxWeekCount,
}: {
  metrics: GrowthMetrics;
  maxWeekCount: number;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-heading-3 font-bold text-ink">꾸준함</h2>
        <p className="mt-1 text-caption text-text-secondary">
          많이 할수록 좋다는 뜻은 아니에요. 리듬만 확인해요.
        </p>
      </div>

      <Card variant="paper">
        <Stack gap={3}>
          <p className="text-label font-bold text-text-secondary">최근 4주</p>
          <Stack direction="row" gap={3} align="end">
            {metrics.recentWeeks.map((week, index) => (
              <Stack key={week.weekStart} gap={1} align="center" className="flex-1">
                {week.completedCount === 0 ? (
                  /*
                    0인 주에 채워진 막대를 두면 "조금 했다"로 읽힌다. 실제로 35 vs 0
                    화면에서 0인 주가 활동이 있는 것처럼 보였다 — 빈 주는 점선으로
                    비워 둬서 "없음"이 없음으로 보이게 한다.
                  */
                  <div
                    className="h-1 w-full rounded-control border-b-2 border-dashed border-border"
                    aria-hidden="true"
                  />
                ) : (
                  <div
                    className={cn(
                      "w-full bg-brand",
                      // 기준을 넘긴 막대는 위가 잘린 형태로 둬서 "더 있음"을 알린다.
                      week.completedCount > maxWeekCount
                        ? "rounded-b-control"
                        : "rounded-control",
                    )}
                    style={{
                      height: `${Math.min(
                        BAR_MAX_HEIGHT,
                        Math.max(6, (week.completedCount / maxWeekCount) * BAR_MAX_HEIGHT),
                      )}px`,
                    }}
                    aria-hidden="true"
                  />
                )}
                <p className="text-caption font-bold text-ink">{week.completedCount}</p>
                <p className="text-caption text-text-tertiary">{WEEK_LABELS[index]}</p>
              </Stack>
            ))}
          </Stack>
          <p className="text-caption text-text-secondary">
            이번 주에 {metrics.completedThisWeek}번, 지금까지 모두 {metrics.totalCompleted}번
            기록했어요.
          </p>
        </Stack>
      </Card>

      <Card variant="paper">
        <Stack gap={2}>
          <p className="text-label font-bold text-text-secondary">직접 쓴 것들</p>
          <p className="text-body text-ink">
            대안 프레임 {metrics.userAuthoredReframeCount}개를 직접 썼고, 그중{" "}
            {metrics.revisedDefinitionSessionCount}번은 처음 정의를 스스로 고쳐썼어요.
          </p>
        </Stack>
      </Card>
    </section>
  );
}

/**
 * 값의 크기를 Dot의 진하기로만 표현한다(DESIGN.md §10.7: Dot·짧은 Bar·문장만).
 * 축·눈금·툴팁을 두지 않는 이유는, 정확한 수치를 읽게 하려는 것이 아니라
 * "올라갔는지"만 보여주려는 것이기 때문이다. 정확한 값은 옆 문장이 말한다.
 */
function DotTrend({ points, max }: { points: QualityTrendPoint[]; max: number }) {
  const visible = points.slice(-MAX_TREND_DOTS);
  if (visible.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {visible.map((point) => {
        const ratio = max > 0 ? Math.min(1, Math.max(0, point.value / max)) : 0;
        return (
          <span
            key={point.sessionId}
            className="h-2.5 w-2.5 rounded-full bg-brand"
            // 0에 가까울수록 옅게. 완전히 투명해지면 "기록 없음"과 헷갈리므로 하한을 둔다.
            style={{ opacity: 0.25 + ratio * 0.75 }}
          />
        );
      })}
    </div>
  );
}

/** 여섯 항목 중 몇 개가 드러났는지로 환산한다 — 비율(%)은 점수처럼 읽힌다. */
function coverageSentence(shift: TrendShift): string {
  const earlier = (shift.earlier * TOTAL_DIMENSIONS).toFixed(1);
  const recent = (shift.recent * TOTAL_DIMENSIONS).toFixed(1);

  if (Math.abs(shift.delta) < 0.01) {
    return `여섯 항목 중 평균 ${recent}개가 드러났어요. 초기와 비슷한 수준이에요.`;
  }
  if (shift.delta > 0) {
    return `처음에는 여섯 항목 중 평균 ${earlier}개가 드러났고, 최근에는 ${recent}개가 드러났어요.`;
  }
  return `처음에는 평균 ${earlier}개가 드러났는데 최근에는 ${recent}개예요. 더 어려운 장면을 고르고 있는 것일 수도 있어요.`;
}

function calibrationSentence(trend: QualityTrendPoint[]): string {
  const latest = trend[trend.length - 1]?.value ?? 0;
  if (trend.length === 1) {
    return `가장 최근 기록에서는 ${latest}개 항목이 어긋났어요.`;
  }
  const first = trend[0]?.value ?? 0;
  if (latest < first) {
    return `어긋난 항목이 ${first}개에서 ${latest}개로 줄었어요.`;
  }
  if (latest > first) {
    return `어긋난 항목이 ${first}개에서 ${latest}개로 늘었어요. 더 엄격하게 보고 있다는 뜻일 수도 있어요.`;
  }
  return `어긋난 항목이 ${latest}개로 비슷하게 유지되고 있어요.`;
}

function hintSentence(shift: TrendShift): string {
  const earlier = Math.round(shift.earlier * 100);
  const recent = Math.round(shift.recent * 100);

  if (shift.delta < -0.05) {
    return `가장 구체적인 힌트를 쓴 비율이 ${earlier}%에서 ${recent}%로 줄었어요.`;
  }
  if (shift.delta > 0.05) {
    return `가장 구체적인 힌트를 쓴 비율이 ${earlier}%에서 ${recent}%로 늘었어요. 막히는 지점이 어디인지 살펴볼 만해요.`;
  }
  return `가장 구체적인 힌트를 쓴 비율은 ${recent}% 정도로 비슷해요.`;
}
