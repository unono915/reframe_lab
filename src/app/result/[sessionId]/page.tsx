"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge, Button, Card, LinkButton, PageState, Stack } from "@/components/ui";
import type {
  AuthorType,
  TrainingSessionSnapshot,
  TrainingTemplate,
} from "@/domain/types";
import { sessionStatusLabel } from "@/domain/training/stages";
import {
  compareSelfAssessmentWithAi,
  overconfidentDimensions,
} from "@/domain/training/self-assessment";
import { fetchJson } from "@/lib/fetch-json";

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const AUTHOR_BADGE: Record<
  AuthorType,
  { label: string; variant: "user" | "ai" | "system" }
> = {
  user: { label: "내가 쓴 문장", variant: "user" },
  ai: { label: "다시봄 코치", variant: "ai" },
  system_template: { label: "오늘의 관찰 렌즈", variant: "system" },
};

function AuthorBadge({ authorType }: { authorType: AuthorType }) {
  const cfg = AUTHOR_BADGE[authorType];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

/**
 * setState를 하지 않는 순수 로더 — 화면 상태 적용은 호출자가 한다.
 *
 * 예전에는 `fetch(...).then((res) => res.json())`을 그대로 썼다. 응답이 2xx가
 * 아니거나 본문이 비면 `json()`이 SyntaxError를 던지는데, 그 자리에 catch가 없어
 * `Promise.all`이 통째로 reject되고 `setLoading(false)`에 닿지 못했다 — 화면이
 * "기록을 불러오고 있어요"에서 영영 멈췄다. Home·History·Growth에서 이미 같은
 * 이유로 고쳤던 버그가 이 화면에만 남아 있었다.
 */
async function loadResult(sessionId: string) {
  const [session, templates] = await Promise.all([
    fetchJson<{ snapshot: TrainingSessionSnapshot | null }>(`/api/sessions/${sessionId}`),
    fetchJson<{ templates: TrainingTemplate[] }>("/api/templates"),
  ]);
  return { session, templates };
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
  const [originSnapshot, setOriginSnapshot] = useState<TrainingSessionSnapshot | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [revisitPending, setRevisitPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  /** 두 동작의 실패 안내를 함께 쓴다 — 한 번에 하나만 진행되므로 섞일 일이 없다. */
  const [actionError, setActionError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const apply = useCallback((result: Awaited<ReturnType<typeof loadResult>>) => {
    if (!result.session.ok) {
      // 404("요청한 세션을 찾을 수 없어요")와 서버 오류·네트워크 단절을 구분해서
      // 보여준다 — 예전에는 셋 다 "기록을 찾을 수 없어요"로 뭉뚱그렸다.
      setPageError(result.session.message);
      setLoading(false);
      return;
    }
    const loaded = result.session.data.snapshot;
    setSnapshot(loaded);
    // 렌즈 이름은 보조 정보라 실패해도 본문은 보여준다.
    if (loaded && result.templates.ok) {
      setTemplate(
        result.templates.data.templates.find((t) => t.id === loaded.session.templateId) ??
          null,
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadResult(params.sessionId).then((result) => {
      if (cancelled) return;
      apply(result);
      // 원본 기록은 Revisit 세션에서만 쓰는 보조 카드라, 실패해도 본문은 그대로 보여준다.
      const originId = result.session.ok
        ? result.session.data.snapshot?.session.originSessionId
        : null;
      if (!originId) return;
      void fetchJson<{ snapshot: TrainingSessionSnapshot | null }>(
        `/api/sessions/${originId}`,
      ).then((origin) => {
        if (!cancelled && origin.ok) setOriginSnapshot(origin.data.snapshot);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId, apply]);

  function handleRetry() {
    setPageError(null);
    setLoading(true);
    void loadResult(params.sessionId).then(apply);
  }

  async function handleRevisit() {
    if (!snapshot) return;
    setRevisitPending(true);
    setActionError(null);
    // 예전에는 `await fetch`를 그대로 썼다 — 실패하면 조용히 return해서 버튼이
    // 아무 반응 없이 끝났고, 오프라인이면 fetch가 reject하는 바람에
    // setRevisitPending(false)에 닿지 못해 **버튼이 영영 "만드는 중"에 멈췄다.**
    // fetchJson은 절대 throw하지 않고 실패를 한국어 문장으로 돌려준다.
    const result = await fetchJson<{ snapshot: TrainingSessionSnapshot }>(
      `/api/sessions/${snapshot.session.id}/revisit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone: detectTimezone(),
          clientRequestId: crypto.randomUUID(),
        }),
      },
    );
    setRevisitPending(false);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    router.push(`/training/${result.data.snapshot.session.id}`);
  }

  async function handleDelete() {
    if (!snapshot) return;
    setDeletePending(true);
    setActionError(null);
    // 되돌릴 수 없는 동작이라 "됐는지 안 됐는지 모르겠다"가 특히 나쁘다.
    const result = await fetchJson(`/api/sessions/${snapshot.session.id}`, {
      method: "DELETE",
    });
    setDeletePending(false);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    router.push("/history");
  }

  if (pageError) {
    return <PageState status="error" message={pageError} onRetry={handleRetry} />;
  }
  if (loading) {
    return <PageState status="loading" loadingLabel="기록을 불러오고 있어요." />;
  }
  if (!snapshot) {
    // 서버가 200으로 `snapshot: null`을 준 경우 — 정말 없는 기록이다.
    return <PageState status="error" message="기록을 찾을 수 없어요." />;
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
  const otherQuestions = snapshot.questions.filter(
    (q) => q.authorType === "user" && !q.isPriority,
  );
  const explorationResponses = snapshot.stageResponses.filter(
    (r) => r.stage === "exploration" && !r.isDraft,
  );
  const userReframes = snapshot.reframes.filter((r) => r.authorType === "user");

  /*
    그때 스스로 어떻게 판단했는지도 기록의 일부다. 저장은 P0-2부터 되고 있었는데
    이 화면에만 빠져 있어서, 다시 볼 때 남는 것은 결과물뿐이었다.

    특히 2주 뒤에 다시 여는 자리(P1-8)에서 의미가 있다 — 그때의 판단과 지금 읽는
    문장을 나란히 놓아야 "무엇을 놓치고 있었는지"가 보인다. 훈련 중에 보던 대조를
    기록에서도 똑같이 보여준다(같은 순수 함수를 쓴다).
  */
  const comparisons = compareSelfAssessmentWithAi(snapshot, feedback ?? null);
  const overconfident = overconfidentDimensions(comparisons);

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-[640px] flex-col gap-8 px-5 py-10">
      <Stack gap={2}>
        <Stack direction="row" justify="between" align="center" gap={2}>
          <p className="text-caption font-bold text-success">지금의 생각을 기록했어요.</p>
          <Button
            type="button"
            variant="tertiary"
            onClick={() => router.push("/history")}
          >
            기록 목록
          </Button>
        </Stack>
        <Stack direction="row" gap={2} align="center">
          <p className="text-caption text-text-secondary">
            {snapshot.session.trainingDate}
          </p>
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
            <p className="text-label font-bold text-brand-strong">
              지금 생각 (v{latest.versionNumber})
            </p>
            <p className="text-body text-ink">{latest.text}</p>
            {latest.changeReason && (
              <p className="mt-2 text-caption text-text-secondary">
                바꾼 이유: {latest.changeReason}
              </p>
            )}
          </Card>
        </Stack>
      )}

      {originSnapshot && latest && (
        <Stack gap={3}>
          <p className="text-heading-3 font-bold text-ink">원본 기록과 나란히 비교</p>
          <p className="text-caption text-text-secondary">
            {originSnapshot.session.trainingDate}에 다시 본 장면을 여기서 다시
            생각해봤어요. 원본은 바뀌지 않아요.
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

      {comparisons.length > 0 && (
        <Stack gap={3}>
          <p className="text-heading-3 font-bold text-ink">그때의 자기 점검</p>
          <Card variant="paper">
            <Stack gap={2}>
              {comparisons.map((c) => (
                <div key={c.key} className="flex items-start justify-between gap-3">
                  <p className="text-body text-ink">{c.label}</p>
                  <span className="shrink-0">
                    <Badge variant={c.self === "shown" ? "user" : "neutral"}>
                      {c.self === "shown" ? "드러나 있어요" : "아직이에요"}
                    </Badge>
                  </span>
                </div>
              ))}
            </Stack>
          </Card>
          {overconfident.length > 0 && (
            <Card variant="coach">
              <p className="text-label font-bold text-brand-strong">
                스스로는 드러났다고 보셨지만, 코치는 근거를 찾지 못한 항목이에요
              </p>
              <ul className="mt-2 list-disc pl-5 text-body text-ink">
                {overconfident.map((c) => (
                  <li key={c.key}>{c.label}</li>
                ))}
              </ul>
            </Card>
          )}
        </Stack>
      )}

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
          <Badge variant="stale">
            앞선 내용을 수정해 이 피드백은 다시 확인이 필요해요.
          </Badge>
        )
      )}

      <Stack gap={3}>
        {actionError && (
          <p role="alert" className="text-caption font-bold text-danger">
            {actionError}
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={handleRevisit}
          disabled={revisitPending}
        >
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
              <Button
                type="button"
                variant="tertiary"
                onClick={() => setConfirmingDelete(false)}
              >
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
