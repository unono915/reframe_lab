import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { AIFeedback } from "@/domain/types";
import { hasMinimalUserInput } from "@/domain/training/requirements";
import { runFeedbackGuardrails } from "@/lib/ai/guardrails";
import type { FeedbackOutput } from "@/lib/ai/provider";
import { getActiveCoachProvider } from "@/lib/ai/providers";
import { feedbackOutputSchema } from "@/lib/schemas/feedback-output";
import { checkRateLimit, SESSION_AI_CALL_CAP } from "@/lib/rate-limit";
import { apiError } from "@/lib/errors";
import { createRouteContext, loadOwnedSnapshot, withIdempotency } from "../../../_lib/route-context";

const requestSchema = z.object({ clientRequestId: z.string().min(1) });

/**
 * 정의(definition) 문장 하나에 대해 피드백을 1회 생성한다. AI가 실패하면 가짜
 * 피드백을 만들어내지 않는다 — feedback 단계의 진짜 fallback은 자기 점검
 * 체크리스트다(requirements.ts checkFeedback의 예외 경로). 이 Route는 실패 시
 * 그냥 오류를 반환하고, 클라이언트는 이미 있는 체크리스트 UI로 계속한다.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;
  const { supabase, userId, repos } = ctx;

  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) return apiError("validation_error", parsed.error.issues[0]?.message);
  const { clientRequestId } = parsed.data;

  return withIdempotency(supabase, userId, clientRequestId, async () => {
    const current = await loadOwnedSnapshot(repos, sessionId, userId);
    if (!current) return apiError("not_found");

    if (!hasMinimalUserInput("definition", current)) {
      return apiError("requirement_not_met", "먼저 문제 정의를 작성한 뒤에 피드백을 요청할 수 있어요.");
    }
    if (current.session.aiCallCount >= SESSION_AI_CALL_CAP) {
      return apiError(
        "validation_error",
        "이번 세션은 AI 호출 상한에 도달했어요. 자기 점검으로 완료할 수 있어요.",
      );
    }
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.ok) {
      return apiError("validation_error", "너무 빠르게 요청했어요. 잠시 후 다시 시도해주세요.");
    }

    const latest = [...current.problemDefinitionVersions].sort(
      (a, b) => b.versionNumber - a.versionNumber,
    )[0];
    if (!latest) return apiError("requirement_not_met", "먼저 문제 정의를 작성해주세요.");

    const supportingText = [
      current.observation?.rawText ?? "",
      ...current.observationItems.filter((i) => i.userConfirmed).map((i) => i.text),
      ...current.questions.filter((q) => q.authorType === "user").map((q) => q.text),
      ...current.stageResponses
        .filter((r) => r.stage === "exploration" && !r.isDraft)
        .map((r) => r.content),
      ...current.perspectives.filter((p) => p.authorType === "user").map((p) => p.content),
      ...current.reframes.filter((r) => r.authorType === "user").map((r) => r.text),
      latest.text,
    ].join("\n");

    const provider = getActiveCoachProvider();
    let validated = null as ReturnType<typeof feedbackOutputSchema.safeParse> | null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let raw: FeedbackOutput | undefined;
      try {
        raw = await provider.getFeedback({ definitionText: latest.text, supportingText });
      } catch {
        continue;
      }
      const parsedOutput = feedbackOutputSchema.safeParse(raw);
      if (!parsedOutput.success) continue;
      if (runFeedbackGuardrails(parsedOutput.data, supportingText).ok) {
        validated = parsedOutput;
        break;
      }
    }

    if (!validated || !validated.success) {
      return apiError(
        "internal_error",
        "지금은 AI 피드백을 만들 수 없어요. 아래 자기 점검으로 완료할 수 있어요.",
      );
    }

    const feedback: AIFeedback = {
      id: crypto.randomUUID(),
      sessionId: current.session.id,
      problemDefinitionVersionId: latest.id,
      dimensions: validated.data.dimensions,
      strength: validated.data.strength,
      improvementFocus: validated.data.improvementFocus,
      unverifiedAssumption: validated.data.unverifiedAssumption,
      nextQuestion: validated.data.nextQuestion,
      provider: provider.provider,
      model: provider.model,
      promptVersion: provider.promptVersion,
      schemaVersion: provider.schemaVersion,
      isStale: false,
      createdAt: new Date().toISOString(),
    };
    const saved = await repos.sessionRepository.saveSnapshot({
      ...current,
      aiFeedbacks: [...current.aiFeedbacks, feedback],
      session: { ...current.session, aiCallCount: current.session.aiCallCount + 1 },
    });

    return NextResponse.json({ feedback, snapshot: saved });
  });
}
