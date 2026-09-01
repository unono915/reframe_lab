"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Field, Stack, Textarea } from "@/components/ui";
import { SELF_CHECK_ITEMS, type SelfCheckKey } from "@/domain/training/requirements";
import {
  compareSelfAssessmentWithAi,
  hasCompletedSelfAssessment,
  overconfidentDimensions,
  readSelfAssessment,
  type SelfAssessmentStatus,
} from "@/domain/training/self-assessment";
import { StageShell } from "../StageShell";
import { useTrainingSession } from "../TrainingSessionProvider";

type AssessmentDraft = Partial<Record<SelfCheckKey, SelfAssessmentStatus>>;

/**
 * 돌아보기 단계 (RESEARCH_VALIDATION.md §5 P0-2·P0-4로 재구성).
 *
 * 이전 구조의 문제 세 가지를 함께 고쳤다.
 * 1. 자기 점검이 "AI 실패 시 대체 경로"로 강등돼 있었다 — 루브릭의 학습 효과는
 *    자기평가 목적으로 쓸 때 가장 크므로, AI 피드백보다 **먼저** 답하게 한다.
 * 2. AI가 생성해 저장하던 차원별 판정(`dimensions`)이 화면에서 전혀 쓰이지 않았다 —
 *    이제 사용자 판단과 나란히 놓고 **어긋난 차원**을 짚어준다(메타인지 보정).
 * 3. PRD §8 8단계가 요구하는 **v2 작성 경로가 아예 없었다** — 완료밖에 못 했다.
 *    v2를 쓸 때는 "왜 바꿨는지"를 함께 받는다(자기설명 효과).
 */
export function FeedbackStage() {
  const router = useRouter();
  const { snapshot, requestFeedback, completeSelfCheck, submitDefinition, advance } =
    useTrainingSession();

  const [feedbackPending, setFeedbackPending] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AssessmentDraft>({});
  const [editing, setEditing] = useState(false);
  const [savePending, setSavePending] = useState(false);

  const [revising, setRevising] = useState(false);
  const [revisedText, setRevisedText] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [reviseError, setReviseError] = useState<string | null>(null);

  if (!snapshot) return null;

  const latestVersion = snapshot.problemDefinitionVersions.reduce<
    (typeof snapshot.problemDefinitionVersions)[number] | null
  >((max, v) => (!max || v.versionNumber > max.versionNumber ? v : max), null);

  const latestFeedback =
    snapshot.aiFeedbacks
      .filter((f) => !f.isStale && f.problemDefinitionVersionId === latestVersion?.id)
      .at(-1) ?? null;

  // DESIGN.md §11 UI States "Stale Feedback": 앞선 단계를 고쳐서 이전 피드백이
  // 무효화된 경우, 조용히 "피드백 없음"으로 보이면 사용자가 왜 사라졌는지 알 수 없다.
  const staleFeedbackExists = snapshot.aiFeedbacks.some(
    (f) => f.isStale && f.problemDefinitionVersionId === latestVersion?.id,
  );

  const assessmentSaved = hasCompletedSelfAssessment(snapshot);
  const showForm = !assessmentSaved || editing;
  const currentAnswers = showForm ? draft : readSelfAssessment(snapshot);
  const allAnswered = SELF_CHECK_ITEMS.every((item) => currentAnswers[item.key] !== undefined);

  const comparisons = compareSelfAssessmentWithAi(snapshot, latestFeedback);
  const overconfident = overconfidentDimensions(comparisons);

  async function handleSaveAssessment() {
    if (!allAnswered) return;
    setSavePending(true);
    await completeSelfCheck(
      SELF_CHECK_ITEMS.map((item) => ({
        key: item.key,
        status: draft[item.key] as SelfAssessmentStatus,
      })),
    );
    setSavePending(false);
    setEditing(false);
  }

  async function handleGetFeedback() {
    setFeedbackPending(true);
    setFeedbackError(null);
    const result = await requestFeedback();
    setFeedbackPending(false);
    if (!result.ok) setFeedbackError(result.message);
  }

  async function handleSubmitRevision() {
    if (!revisedText.trim()) {
      setReviseError("고쳐 쓴 문제 정의를 적어주세요.");
      return;
    }
    if (!changeReason.trim()) {
      // 자기설명(self-explanation)이 이 단계의 핵심이라 비워둘 수 없게 한다.
      setReviseError("무엇이 왜 달라졌는지 한 줄만 남겨주세요.");
      return;
    }
    setReviseError(null);
    await submitDefinition({ text: revisedText, changeReason });
    setRevising(false);
    setRevisedText("");
    setChangeReason("");
  }

  async function handlePrimaryAction() {
    const sessionId = snapshot?.session.id;
    const result = await advance();
    if (result.ok && sessionId) {
      router.push(`/result/${sessionId}`);
    }
    return result;
  }

  return (
    <StageShell
      description="지금까지의 생각을 돌아볼까요?"
      primaryLabel="이대로 완료하기"
      onPrimaryAction={handlePrimaryAction}
    >
      <Stack gap={6}>
        {latestVersion && (
          <Card variant="paper">
            <p className="text-label font-bold text-brand-strong">
              현재의 문제 정의 {latestVersion.versionNumber > 1 && `(v${latestVersion.versionNumber})`}
            </p>
            <p className="text-body-lg text-ink">{latestVersion.text}</p>
          </Card>
        )}

        {/* 1) 사용자가 먼저 판단한다 — AI 피드백보다 앞선다. */}
        <Stack gap={3}>
          <p className="text-heading-3 font-bold text-ink">먼저 스스로 점검해볼까요?</p>
          <p className="text-caption text-text-secondary">
            내가 쓴 정의에 아래 항목이 드러나 있는지 스스로 판단해보세요. 정답은 없어요.
          </p>

          {showForm ? (
            <Stack gap={3}>
              {SELF_CHECK_ITEMS.map((item) => (
                <fieldset key={item.key} className="rounded-control bg-warm-gray px-4 py-3">
                  <legend className="text-label font-bold text-ink">{item.label}</legend>
                  <div className="mt-2 flex gap-4">
                    {(
                      [
                        { value: "shown", label: "드러나 있어요" },
                        { value: "not_yet", label: "아직이에요" },
                      ] as const
                    ).map((option) => (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 text-body text-ink"
                      >
                        <input
                          type="radio"
                          name={`self-check-${item.key}`}
                          value={option.value}
                          checked={draft[item.key] === option.value}
                          onChange={() =>
                            setDraft((prev) => ({ ...prev, [item.key]: option.value }))
                          }
                          className="h-5 w-5 accent-brand"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <Button
                type="button"
                variant="secondary"
                disabled={!allAnswered || savePending}
                onClick={handleSaveAssessment}
              >
                {savePending ? "저장 중" : "점검 마치기"}
              </Button>
            </Stack>
          ) : (
            <Stack gap={2}>
              {comparisons.map((c) => (
                <div
                  key={c.key}
                  className="flex items-center justify-between gap-3 rounded-control bg-warm-gray px-4 py-3"
                >
                  <span className="text-body text-ink">{c.label}</span>
                  <Badge variant={c.self === "shown" ? "user" : "neutral"}>
                    {c.self === "shown" ? "드러남" : "아직"}
                  </Badge>
                </div>
              ))}
              <Button type="button" variant="tertiary" onClick={() => {
                setDraft(readSelfAssessment(snapshot));
                setEditing(true);
              }}>
                다시 점검하기
              </Button>
            </Stack>
          )}
        </Stack>

        {/* 2) 그다음에야 AI 피드백을 연다. */}
        {assessmentSaved && !editing && (
          <Stack gap={3}>
            <p className="text-heading-3 font-bold text-ink">코치의 시선과 견줘보기</p>

            {latestFeedback ? (
              <Stack gap={3}>
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
                    <p className="mt-2 text-caption text-text-secondary">
                      틀렸다는 뜻은 아니에요. 내 머릿속에는 있지만 문장에는 안 적힌 것일 수 있어요.
                    </p>
                  </Card>
                )}

                <Card variant="coach">
                  <p className="text-label font-bold text-brand-strong">이미 드러난 점</p>
                  <p className="text-body text-ink">{latestFeedback.strength}</p>
                </Card>
                <Card variant="coach">
                  <p className="text-label font-bold text-brand-strong">더 살펴볼 점</p>
                  <p className="text-body text-ink">{latestFeedback.improvementFocus}</p>
                </Card>
                <Card variant="coach">
                  <p className="text-label font-bold text-brand-strong">아직 가설인 점</p>
                  <p className="text-body text-ink">{latestFeedback.unverifiedAssumption}</p>
                </Card>
                <p className="text-body-lg text-ink">{latestFeedback.nextQuestion}</p>
              </Stack>
            ) : (
              <Stack gap={2}>
                {staleFeedbackExists && (
                  <Badge variant="stale">
                    앞선 내용을 수정해 이 피드백을 다시 확인해야 해요.
                  </Badge>
                )}
                {feedbackError && (
                  <p
                    role="alert"
                    className="rounded-control bg-danger-bg px-4 py-3 text-label font-bold text-danger"
                  >
                    {feedbackError} 위 자기 점검만으로도 완료할 수 있어요.
                  </p>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleGetFeedback}
                  disabled={feedbackPending}
                >
                  {feedbackPending
                    ? "AI 피드백 요청 중"
                    : feedbackError
                      ? "다시 시도"
                      : staleFeedbackExists
                        ? "AI 피드백 다시 보기"
                        : "AI 피드백 보기"}
                </Button>
              </Stack>
            )}
          </Stack>
        )}

        {/* 3) PRD §8 8단계: "v2 작성 또는 완료" — 이전에는 완료밖에 없었다. */}
        {assessmentSaved && !editing && (
          <Stack gap={3}>
            {revising ? (
              <Stack gap={3}>
                <Field
                  id="revised-definition"
                  label="고쳐 쓴 문제 정의"
                  helperText="지운 게 아니라 새 버전으로 쌓여요. 이전 버전도 그대로 남아요."
                >
                  <Textarea
                    value={revisedText}
                    onChange={(e) => setRevisedText(e.target.value)}
                    placeholder="누가, 어떤 상황에서, 무엇을 겪고 있는 문제인가요?"
                  />
                </Field>
                <Field id="change-reason" label="무엇이 왜 달라졌나요?">
                  <Textarea
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    placeholder="예: 영향을 받는 사람을 빼놓고 썼다는 걸 알았어요."
                  />
                </Field>
                {reviseError && (
                  <p role="alert" className="text-caption font-bold text-danger">
                    {reviseError}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={handleSubmitRevision}>
                    새 버전으로 기록하기
                  </Button>
                  <Button type="button" variant="tertiary" onClick={() => setRevising(false)}>
                    그만두기
                  </Button>
                </div>
              </Stack>
            ) : (
              <Button
                type="button"
                variant="tertiary"
                onClick={() => {
                  setRevisedText(latestVersion?.text ?? "");
                  setRevising(true);
                }}
              >
                다시 써보기
              </Button>
            )}
          </Stack>
        )}
      </Stack>
    </StageShell>
  );
}
