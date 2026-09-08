"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, InlineError, LinkButton, PageState, Stack } from "@/components/ui";
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

interface HomePayload {
  activeSession: TrainingSession | null;
  template: TrainingTemplate | null;
  recentRecord: SessionSummary | null;
  revisitCandidate: { session: SessionSummary; days: number } | null;
}

type HomeData = ({ ok: true } & HomePayload) | { ok: false; message: string };

/**
 * setState를 하지 않는 순수 로더 — 화면 상태 적용은 호출자가 한다.
 *
 * 요청은 **한 번**이다. 예전에는 세 번이었고 그중 둘은 순서대로 기다려야 했다 —
 * 활성 세션을 먼저 물어봐야 오늘의 렌즈를 뽑을지 정할 수 있었기 때문이다. 그 판단은
 * 서버에서 하면 왕복이 필요 없어서 `/api/home`으로 합쳤다(그 라우트 주석 참고).
 * 매일 여는 화면이 오늘의 문장을 보여주기까지 기다리는 왕복이 둘 줄었다.
 */
async function fetchHome(): Promise<HomeData> {
  const result = await fetchJson<HomePayload>(
    `/api/home?timezone=${encodeURIComponent(detectTimezone())}`,
  );
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, ...result.data };
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
  const [revisitCandidate, setRevisitCandidate] = useState<SessionSummary | null>(null);
  const [revisitDays, setRevisitDays] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    setSignOutError(null);
    const result = await signOut();
    if (!result.ok) {
      // 로그아웃이 실패했는데 로그인 화면으로 보내면, 세션은 살아 있는 채로
      // 나간 것처럼 보인다. 실패했다고 말하고 이 자리에 남는다.
      setSignOutError(result.message);
      return;
    }
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
    setRecentRecord(result.recentRecord);
    setRevisitCandidate(result.revisitCandidate?.session ?? null);
    setRevisitDays(result.revisitCandidate?.days ?? 0);
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

  function handleRetry() {
    setStatus("loading");
    setError(null);
    void fetchHome().then(apply);
  }

  if (status === "error") {
    return (
      <PageState status="error" message={error ?? undefined} onRetry={handleRetry} />
    );
  }

  const isResuming = activeSession && activeSession.status !== "completed";
  const trainingHref = activeSession ? `/training/${activeSession.id}` : "/training/new";

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-[640px] flex-col justify-center px-5 py-10">
      <Stack gap={8}>
        <Stack direction="row" justify="between" align="center" gap={2}>
          <Stack direction="row" gap={4}>
            <Button
              type="button"
              variant="tertiary"
              onClick={() => router.push("/history")}
            >
              기록
            </Button>
            <Button
              type="button"
              variant="tertiary"
              onClick={() => router.push("/growth")}
            >
              성장
            </Button>
          </Stack>
          <Button type="button" variant="tertiary" onClick={handleSignOut}>
            로그아웃
          </Button>
        </Stack>
        <InlineError message={signOutError} />
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

        {/*
          간격을 두고 다시 보기 (PRD §6.5 P1). 방금 쓴 정의는 머릿속 맥락이 남아
          있어 무엇이 빠졌는지 보이지 않는다 — 2주쯤 지나 맥락이 흐려진 뒤에 읽어야
          문장이 실제로 무엇을 담고 있는지 보인다.
          후보가 있을 때는 "최근 기록"보다 이쪽이 더 할 만한 일이라 자리를 내준다.
        */}
        {revisitCandidate ? (
          <Card
            variant="interactive"
            onClick={() => router.push(`/result/${revisitCandidate.id}`)}
          >
            <Stack gap={2}>
              <p className="text-label font-bold text-brand-strong">다시 볼 만한 기록</p>
              <p className="line-clamp-2 text-body text-ink">
                {revisitCandidate.latestDefinitionText ??
                  revisitCandidate.observationText}
              </p>
              <p className="text-caption text-text-secondary">
                {revisitDays}일 전에 쓴 문장이에요. 지금 다시 보면 어떻게 보일까요?
              </p>
            </Stack>
          </Card>
        ) : (
          recentRecord && (
            <Card
              variant="interactive"
              onClick={() => router.push(`/result/${recentRecord.id}`)}
            >
              <Stack gap={2}>
                <p className="text-label font-bold text-text-secondary">
                  최근 다시 본 기록
                </p>
                <p className="line-clamp-2 text-body text-ink">
                  {recentRecord.latestDefinitionText ?? recentRecord.observationText}
                </p>
              </Stack>
            </Card>
          )
        )}
      </Stack>
    </main>
  );
}
