"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, LinkButton, Stack } from "@/components/ui";
import type { TrainingSession, TrainingTemplate } from "@/domain/types";
import { signOut } from "@/lib/auth/client";

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
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

  async function handleSignOut() {
    await signOut();
    router.push("/auth/login");
    router.refresh();
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const activeRes = await fetch("/api/sessions?status=active");
      const activeBody = (await activeRes.json()) as {
        snapshot: { session: TrainingSession } | null;
      };

      if (activeBody.snapshot) {
        const templatesRes = await fetch("/api/templates");
        const templatesBody = (await templatesRes.json()) as { templates: TrainingTemplate[] };
        const t =
          templatesBody.templates.find(
            (item) => item.id === activeBody.snapshot?.session.templateId,
          ) ?? null;
        if (!cancelled) {
          setActiveSession(activeBody.snapshot.session);
          setTemplate(t);
        }
        return;
      }

      const todayRes = await fetch(
        `/api/templates/today?timezone=${encodeURIComponent(detectTimezone())}`,
      );
      const todayBody = (await todayRes.json()) as { template: TrainingTemplate };
      if (!cancelled) setTemplate(todayBody.template);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const isResuming = activeSession && activeSession.status !== "completed";
  const trainingHref = activeSession ? `/training/${activeSession.id}` : "/training/new";

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-[640px] flex-col justify-center px-5 py-10">
      <Stack gap={8}>
        <div className="flex justify-end">
          <Button type="button" variant="tertiary" onClick={handleSignOut}>
            로그아웃
          </Button>
        </div>
        <Card variant="daily">
          <Stack gap={3}>
            <p className="text-label font-bold text-brand-strong">오늘 다시 볼 장면</p>
            <p className="text-display-md font-bold text-ink">
              {template?.prompt ?? "오늘의 렌즈를 준비하고 있어요."}
            </p>
          </Stack>
        </Card>
        <LinkButton href={trainingHref} variant="primary" fullWidth>
          {isResuming ? "이어서 하기" : "오늘의 훈련 시작"}
        </LinkButton>
      </Stack>
    </main>
  );
}
