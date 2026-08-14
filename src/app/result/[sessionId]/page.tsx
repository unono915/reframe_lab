"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, LinkButton, Stack } from "@/components/ui";
import type { TrainingSessionSnapshot } from "@/domain/types";
import { sessionRepository } from "@/lib/repositories/memory";

/**
 * S-04 Problem Definition Result (DESIGN.md §10.4). "완료"보다 "현재의 정의"를 강조하고
 * (§10.4 Completion Treatment), Confetti·큰 Success Icon을 쓰지 않는다.
 */
export default function ResultPage() {
  const params = useParams<{ sessionId: string }>();
  const [snapshot, setSnapshot] = useState<TrainingSessionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void sessionRepository.getSnapshot(params.sessionId).then((result) => {
      if (!cancelled) {
        setSnapshot(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId]);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-5">
        <p className="text-body text-text-secondary">기록을 불러오고 있어요.</p>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-5">
        <p className="text-body font-bold text-danger">기록을 찾을 수 없어요.</p>
      </main>
    );
  }

  const versions = [...snapshot.problemDefinitionVersions].sort(
    (a, b) => a.versionNumber - b.versionNumber,
  );
  const first = versions[0];
  const latest = versions.at(-1);
  const feedback = snapshot.aiFeedbacks
    .filter((f) => !f.isStale && f.problemDefinitionVersionId === latest?.id)
    .at(-1);

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-[640px] flex-col gap-8 px-5 py-10">
      <Stack gap={2}>
        <p className="text-caption font-bold text-success">지금의 생각을 기록했어요.</p>
      </Stack>

      {latest && (
        <Card variant="paper">
          <Stack gap={2}>
            <p className="text-label font-bold text-brand-strong">현재의 문제 정의</p>
            <p className="text-body-lg text-ink">{latest.text}</p>
            <p className="text-caption text-text-secondary">v{latest.versionNumber}</p>
          </Stack>
        </Card>
      )}

      {first && latest && first.id !== latest.id && (
        <Stack gap={3}>
          <p className="text-heading-3 font-bold text-ink">처음 생각과 지금 생각</p>
          <Card variant="neutral">
            <p className="text-label font-bold text-text-secondary">처음 생각</p>
            <p className="text-body text-ink">{first.text}</p>
          </Card>
          <Card variant="cream">
            <p className="text-label font-bold text-brand-strong">지금 생각</p>
            <p className="text-body text-ink">{latest.text}</p>
          </Card>
        </Stack>
      )}

      {feedback && (
        <Stack gap={3}>
          <Card variant="coach">
            <p className="text-label font-bold text-brand-strong">이미 드러난 점</p>
            <p className="text-body text-ink">{feedback.strength}</p>
          </Card>
          <Card variant="coach">
            <p className="text-label font-bold text-brand-strong">더 살펴볼 점</p>
            <p className="text-body text-ink">{feedback.improvementFocus}</p>
          </Card>
          <Card variant="coach">
            <p className="text-label font-bold text-brand-strong">아직 가설인 점</p>
            <p className="text-body text-ink">{feedback.unverifiedAssumption}</p>
          </Card>
        </Stack>
      )}

      <LinkButton href="/" variant="primary" fullWidth>
        홈으로 돌아가기
      </LinkButton>
    </main>
  );
}
