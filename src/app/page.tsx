"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, LinkButton, Stack } from "@/components/ui";
import { selectTemplateForDate } from "@/domain/templates/selection";
import type { TrainingSession, TrainingTemplate } from "@/domain/types";
import { sessionRepository, templateRepository } from "@/lib/repositories/memory";
import { MOCK_TIMEZONE, MOCK_USER_ID } from "@/features/training/TrainingSessionProvider";
import { signOut } from "@/lib/auth/client";

/**
 * S-02 Home (DESIGN.md §10.2). Phase 2부터는 인메모리 Repository로 실제 오늘의 세션과
 * 렌즈를 보여준다 — 진짜 저장(§14-B)이 붙기 전까지는 브라우저 탭이 살아있는 동안만 유지된다.
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

    function todayDateString(timezone: string): string {
      return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
    }

    async function load() {
      const existing = await sessionRepository.getActiveSessionForUser(MOCK_USER_ID);
      const templates = await templateRepository.listActiveTemplates();

      if (existing) {
        const t =
          templates.find((item) => item.id === existing.session.templateId) ?? null;
        if (!cancelled) {
          setActiveSession(existing.session);
          setTemplate(t);
        }
        return;
      }

      const recentTemplateIds = await sessionRepository.listRecentTemplateIds(
        MOCK_USER_ID,
        5,
      );
      const chosen = selectTemplateForDate({
        date: todayDateString(MOCK_TIMEZONE),
        userId: MOCK_USER_ID,
        templates,
        recentTemplateIds,
      });
      if (!cancelled) setTemplate(chosen);
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
