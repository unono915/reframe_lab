"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge, Button, Card, LinkButton, Stack } from "@/components/ui";
import type {
  AuthorType,
  TrainingSessionSnapshot,
  TrainingTemplate,
} from "@/domain/types";
import { sessionStatusLabel } from "@/domain/training/stages";

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const AUTHOR_BADGE: Record<AuthorType, { label: string; variant: "user" | "ai" | "system" }> = {
  user: { label: "내가 쓴 문장", variant: "user" },
  ai: { label: "다시봄 코치", variant: "ai" },
  system_template: { label: "오늘의 관찰 렌즈", variant: "system" },
};

function AuthorBadge({ authorType }: { authorType: AuthorType }) {
  const cfg = AUTHOR_BADGE[authorType];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

/**
 * S-04 Result 겸 S-06 Record Detail / Revisit (DESIGN.md §10.4, §10.6). 막 완료한
 * 직후에도, History에서 나중에 다시 열어도 같은 화면을 쓴다 — 세션 id만 있으면
 * 언제든 같은 내용을 재구성할 수 있어서(스냅샷이 유일한 진실) 두 화면을 굳이
 * 나누지 않았다.
 */
export default function ResultPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<TrainingSessionSnapshot | null>(null);
  const [template, setTemplate] = useState<TrainingTemplate | null>(null);
  const [originSnapshot, setOriginSnapshot] = useState<TrainingSessionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [revisitPending, setRevisitPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch(`/api/sessions/${params.sessionId}`).then((res) =>
        res.ok ? res.json() : { snapshot: null },
      ) as Promise<{ snapshot: TrainingSessionSnapshot | null }>,
      fetch("/api/templates").then((res) => res.json()) as Promise<{
        templates: TrainingTemplate[];
      }>,
    ]).then(([sessionBody, templatesBody]) => {
      if (cancelled) return;
      setSnapshot(sessionBody.snapshot);
      if (sessionBody.snapshot) {
        setTemplate(
          templatesBody.templates.find((t) => t.id === sessionBody.snapshot?.session.templateId) ??
            null,
        );
      }
      setLoading(false);

      const originId = sessionBody.snapshot?.session.originSessionId;
      if (originId) {
        void fetch(`/api/sessions/${originId}`)
          .then((res) => (res.ok ? res.json() : { snapshot: null }))
          .then((body: { snapshot: TrainingSessionSnapshot | null }) => {
            if (!cancelled) setOriginSnapshot(body.snapshot);
          });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId]);

  async function handleRevisit() {
    if (!snapshot) return;
    setRevisitPending(true);
    const res = await fetch(`/api/sessions/${snapshot.session.id}/revisit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timezone: detectTimezone(),
        clientRequestId: crypto.randomUUID(),
      }),
    });
    setRevisitPending(false);
    if (!res.ok) return;
    const body = (await res.json()) as { snapshot: TrainingSessionSnapshot };
    router.push(`/training/${body.snapshot.session.id}`);
  }

  async function handleDelete() {
    if (!snapshot) return;
    setDeletePending(true);
    const res = await fetch(`/api/sessions/${snapshot.session.id}`, { method: "DELETE" });
    setDeletePending(false);
    if (res.ok || res.status === 204) {
      router.push("/history");
    }
  }

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
  const staleFeedbackExists = snapshot.aiFeedbacks.some(
    (f) => f.isStale && f.problemDefinitionVersionId === latest?.id,
  );

  const confirmedItems = snapshot.observationItems.filter((i) => i.userConfirmed);
  const priorityQuestion = snapshot.questions.find((q) => q.isPriority);
  const otherQuestions = snapshot.questions.filter((q) => q.authorType === "user" && !q.isPriority);
  const explorationResponses = snapshot.stageResponses.filter(
    (r) => r.stage === "exploration" && !r.isDraft,
  );
  const userReframes = snapshot.reframes.filter((r) => r.authorType === "user");

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-[640px] flex-col gap-8 px-5 py-10">
      <Stack gap={2}>
        <Stack direction="row" justify="between" align="center" gap={2}>
          <p className="text-caption font-bold text-success">지금의 생각을 기록했어요.</p>
          <Button type="button" variant="tertiary" onClick={() => router.push("/history")}>
            기록 목록
          </Button>
        </Stack>
        <Stack direction="row" gap={2} align="center">
          <p className="text-caption text-text-secondary">{snapshot.session.trainingDate}</p>
          {template && <Badge variant="system">{template.title}</Badge>}
          <Badge variant={snapshot.session.status === "completed" ? "brand" : "neutral"}>
            {sessionStatusLabel(snapshot.session.status)}
          </Badge>
        </Stack>
      </Stack>

      {latest && (
        <Card variant="paper">
          <Stack gap={2}>
            <p className="text-label font-bold text-brand-strong">현재의 문제 정의</p>
            <p className="text-body-lg text-ink">{latest.text}</p>
            <Stack direction="row" gap={2} align="center">
              <p className="text-caption text-text-secondary">v{latest.versionNumber}</p>
              <AuthorBadge authorType={latest.authorType} />
            </Stack>
          </Stack>
        </Card>
      )}

      {first && latest && first.id !== latest.id && (
        <Stack gap={3}>
          <p className="text-heading-3 font-bold text-ink">처음 생각과 지금 생각</p>
          <Card variant="neutral">
            <p className="text-label font-bold text-text-secondary">처음 생각 (v1)</p>
            <p className="text-body text-ink">{first.text}</p>
          </Card>
          <Card variant="cream">
            <p className="text-label font-bold text-brand-strong">지금 생각 (v{latest.versionNumber})</p>
            <p className="text-body text-ink">{latest.text}</p>
            {latest.changeReason && (
              <p className="mt-2 text-caption text-text-secondary">바꾼 이유: {latest.changeReason}</p>
            )}
          </Card>
        </Stack>
      )}

      {originSnapshot && latest && (
        <Stack gap={3}>
          <p className="text-heading-3 font-bold text-ink">원본 기록과 나란히 비교</p>
          <p className="text-caption text-text-secondary">
            {originSnapshot.session.trainingDate}에 다시 본 장면을 여기서 다시 생각해봤어요.
            원본은 바뀌지 않아요.
          </p>
          <Card variant="neutral">
            <p className="text-label font-bold text-text-secondary">
              원본의 정의 ({originSnapshot.session.trainingDate})
            </p>
            <p className="text-body text-ink">
              {[...originSnapshot.problemDefinitionVersions].sort(
                (a, b) => b.versionNumber - a.versionNumber,
              )[0]?.text ?? "(정의를 아직 기록하지 않았어요)"}
            </p>
          </Card>
          <Card variant="cream">
            <p className="text-label font-bold text-brand-strong">
              이번에 다시 생각한 정의 ({snapshot.session.trainingDate})
            </p>
            <p className="text-body text-ink">{latest.text}</p>
          </Card>
        </Stack>
      )}

      <Stack gap={3}>
        <p className="text-heading-3 font-bold text-ink">사고 과정</p>

        {snapshot.observation && (
          <Card variant="paper">
            <Stack gap={2}>
              <p className="text-label font-bold text-text-secondary">관찰</p>
              <p className="text-body text-ink">{snapshot.observation.rawText}</p>
            </Stack>
          </Card>
        )}

        {confirmedItems.length > 0 && (
          <Card variant="paper">
            <Stack gap={2}>
              <p className="text-label font-bold text-text-secondary">구분</p>
              <Stack gap={1}>
                {confirmedItems.map((item) => (
                  <p key={item.id} className="text-body text-ink">
                    [{item.type}] {item.text}
                  </p>
                ))}
              </Stack>
            </Stack>
          </Card>
        )}

        {priorityQuestion && (
          <Card variant="coach">
            <Stack gap={1}>
              <p className="text-label font-bold text-brand-strong">핵심 질문</p>
              <p className="text-body text-ink">{priorityQuestion.text}</p>
              {priorityQuestion.priorityReason && (
                <p className="text-caption text-text-secondary">
                  고른 이유: {priorityQuestion.priorityReason}
                </p>
              )}
            </Stack>
          </Card>
        )}
        {otherQuestions.length > 0 && (
          <Card variant="paper">
            <Stack gap={1}>
              <p className="text-label font-bold text-text-secondary">다른 질문</p>
              {otherQuestions.map((q) => (
                <p key={q.id} className="text-body text-ink">
                  {q.text}
                </p>
              ))}
            </Stack>
          </Card>
        )}

        {explorationResponses.length > 0 && (
          <Card variant="paper">
            <Stack gap={2}>
              <p className="text-label font-bold text-text-secondary">탐색</p>
              <Stack gap={1}>
                {explorationResponses.map((r) => (
                  <p key={r.id} className="text-body text-ink">
                    {r.content}
                  </p>
                ))}
              </Stack>
            </Stack>
          </Card>
        )}

        {userReframes.length > 0 && (
          <Card variant="paper">
            <Stack gap={2}>
              <p className="text-label font-bold text-text-secondary">대안 프레임</p>
              <Stack gap={1}>
                {userReframes.map((r) => (
                  <p key={r.id} className="text-body text-ink">
                    {r.text}
                  </p>
                ))}
              </Stack>
            </Stack>
          </Card>
        )}
      </Stack>

      {feedback ? (
        <Stack gap={3}>
          <p className="text-heading-3 font-bold text-ink">AI 피드백</p>
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
      ) : (
        staleFeedbackExists && (
          <Badge variant="stale">앞선 내용을 수정해 이 피드백은 다시 확인이 필요해요.</Badge>
        )
      )}

      <Stack gap={3}>
        <Button type="button" variant="secondary" fullWidth onClick={handleRevisit} disabled={revisitPending}>
          {revisitPending ? "새 기록을 만드는 중" : "이 장면 다시 생각하기"}
        </Button>

        {!confirmingDelete ? (
          <Button
            type="button"
            variant="tertiary"
            fullWidth
            onClick={() => setConfirmingDelete(true)}
          >
            이 기록 삭제하기
          </Button>
        ) : (
          <Stack gap={2}>
            <p className="text-caption text-danger">
              삭제하면 이 기록은 되돌릴 수 없어요. Growth 수치도 다시 계산돼요.
            </p>
            <Stack direction="row" gap={2}>
              <Button
                type="button"
                variant="secondary"
                onClick={handleDelete}
                disabled={deletePending}
              >
                {deletePending ? "삭제하는 중" : "삭제 확정"}
              </Button>
              <Button type="button" variant="tertiary" onClick={() => setConfirmingDelete(false)}>
                취소
              </Button>
            </Stack>
          </Stack>
        )}

        <LinkButton href="/" variant="primary" fullWidth>
          홈으로 돌아가기
        </LinkButton>
      </Stack>
    </main>
  );
}
