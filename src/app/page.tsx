"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, LinkButton, PageState, Stack } from "@/components/ui";
import type { SessionSummary, TrainingSession, TrainingTemplate } from "@/domain/types";
import { signOut } from "@/lib/auth/client";
import { fetchJson } from "@/lib/fetch-json";

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

type HomeData =
  | { ok: true; activeSession: TrainingSession | null; template: TrainingTemplate | null }
  | { ok: false; message: string };

/**
 * setState를 하지 않는 순수 로더 — 화면 상태 적용은 호출자가 한다.
 *
 * 오늘의 렌즈와 "이어서 하기" 여부는 Home이 존재하기 위한 필수 정보라 실패하면
 * 오류를 돌려준다. 반면 템플릿 목록 조회는 진행 중 세션의 렌즈 이름을 붙이기 위한
 * 보조 조회라, 실패해도 이름만 비우고 화면은 정상적으로 보여준다.
 */
async function fetchHome(): Promise<HomeData> {
  const activeResult = await fetchJson<{ snapshot: { session: TrainingSession } | null }>(
    "/api/sessions?status=active",
  );
  if (!activeResult.ok) return { ok: false, message: activeResult.message };

  const active = activeResult.data.snapshot;
  if (active) {
    const templatesResult = await fetchJson<{ templates: TrainingTemplate[] }>("/api/templates");
    const template = templatesResult.ok
      ? (templatesResult.data.templates.find((t) => t.id === active.session.templateId) ?? null)
      : null;
    return { ok: true, activeSession: active.session, template };
  }

  const todayResult = await fetchJson<{ template: TrainingTemplate }>(
    `/api/templates/today?timezone=${encodeURIComponent(detectTimezone())}`,
  );
  if (!todayResult.ok) return { ok: false, message: todayResult.message };
  return { ok: true, activeSession: null, template: todayResult.data.template };
}

/**
 * S-02 Home (DESIGN.md §10.2). Phase 3부터는 Route Handler를 거쳐 실제 서버
 * 세션·템플릿을 보여준다 — Repository를 페이지에서 직접 부르지 않는다
 * (app/api/**가 그 경계다. DEVELOPMENT_PLAN.md §4.1).
 */
export default function HomePage() {
  const router = useRouter();
  const [template, setTemplate] = useState<TrainingTemplate | null>(null);
  const [activeSession, setActiveSession] = useState<TrainingSession | null>(null);
  const [recentRecord, setRecentRecord] = useState<SessionSummary | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    await signOut();
    router.push("/auth/login");
    router.refresh();
  }

  const apply = useCallback((result: Awaited<ReturnType<typeof fetchHome>>) => {
    if (!result.ok) {
      setError(result.message);
      setStatus("error");
      return;
    }
    setActiveSession(result.activeSession);
    setTemplate(result.template);
    setStatus("ready");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchHome().then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  useEffect(() => {
    let cancelled = false;
    void fetchJson<{ sessions: SessionSummary[] }>("/api/history").then((result) => {
      if (cancelled || !result.ok) return;
      setRecentRecord(result.data.sessions.find((s) => s.status === "completed") ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleRetry() {
    setStatus("loading");
    setError(null);
    void fetchHome().then(apply);
  }

  if (status === "error") {
    return <PageState status="error" message={error ?? undefined} onRetry={handleRetry} />;
  }

  const isResuming = activeSession && activeSession.status !== "completed";
  const trainingHref = activeSession ? `/training/${activeSession.id}` : "/training/new";

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-[640px] flex-col justify-center px-5 py-10">
      <Stack gap={8}>
        <Stack direction="row" justify="between" align="center" gap={2}>
          <Stack direction="row" gap={4}>
            <Button type="button" variant="tertiary" onClick={() => router.push("/history")}>
              기록
            </Button>
            <Button type="button" variant="tertiary" onClick={() => router.push("/growth")}>
              성장
            </Button>
          </Stack>
          <Button type="button" variant="tertiary" onClick={handleSignOut}>
            로그아웃
          </Button>
        </Stack>
        <Card variant="daily">
          <Stack gap={3}>
            <p className="text-label font-bold text-brand-strong">오늘 다시 볼 장면</p>
            {/*
              화면의 주제를 담은 유일한 문장이라 h1이다 — 시각적 크기는 이미
              display-md라 바뀌지 않고, 스크린리더에만 문서 제목으로 전달된다.
            */}
            <h1 className="text-display-md font-bold text-ink">
              {template?.prompt ?? "오늘의 렌즈를 준비하고 있어요."}
            </h1>
          </Stack>
        </Card>
        <LinkButton href={trainingHref} variant="primary" fullWidth>
          {isResuming ? "이어서 하기" : "오늘의 훈련 시작"}
        </LinkButton>

        {/*
          P1-6 전이 프로브. 이어서 하는 세션에는 띄우지 않는다 — 이미 AI를 썼을 수
          있어서 "혼자 했다"는 기록이 정확하지 않게 된다.
          Primary와 경쟁하지 않도록 작은 글씨 링크로 둔다.
        */}
        {!isResuming && (
          <LinkButton href={`${trainingHref}?solo=1`} variant="tertiary" fullWidth>
            오늘은 코치 없이 해보기
          </LinkButton>
        )}

        {recentRecord && (
          <Card variant="interactive" onClick={() => router.push(`/result/${recentRecord.id}`)}>
            <Stack gap={2}>
              <p className="text-label font-bold text-text-secondary">최근 다시 본 기록</p>
              <p className="line-clamp-2 text-body text-ink">
                {recentRecord.latestDefinitionText ?? recentRecord.observationText}
              </p>
            </Stack>
          </Card>
        )}
      </Stack>
    </main>
  );
}
