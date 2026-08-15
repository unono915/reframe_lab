import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { CoachInteraction, Stage } from "@/domain/types";
import { hasMinimalUserInput } from "@/domain/training/requirements";
import { buildCoachContext } from "@/lib/ai/context";
import { getFallbackQuestion } from "@/lib/ai/fallback";
import { runCoachGuardrails } from "@/lib/ai/guardrails";
import { getActiveCoachProvider } from "@/lib/ai/providers";
import { coachOutputSchema, type CoachOutputSchema } from "@/lib/schemas/coach-output";
import { checkRateLimit, SESSION_AI_CALL_CAP } from "@/lib/rate-limit";
import { apiError } from "@/lib/errors";
import { createRouteContext, loadOwnedSnapshot, withIdempotency } from "../../../_lib/route-context";

const requestSchema = z.object({
  hintLevel: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  clientRequestId: z.string().min(1),
});

/**
 * DEVELOPMENT_PLAN.md §8.5 응답 처리 순서를 그대로 구현한다: 성공 → 저장, 검증
 * 실패 → 재시도 1회 → 그래도 실패면 규칙 기반 fallback. 어떤 경로든 세션은
 * 완주할 수 있다(CLAUDE.md 원칙 8) — 이 함수가 절대 throw로 끝나지 않는 이유다.
 */
async function getValidatedCoachOutput(
  stage: Exclude<Stage, "not_started">,
  hintLevel: 0 | 1 | 2,
  userText: string,
  recentQuestions: string[],
): Promise<{ output: CoachOutputSchema; status: "ok" | "fallback"; errorCode?: string }> {
  const provider = getActiveCoachProvider();
  const context = { stage, hintLevel, userText, recentQuestions };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await provider.getCoachResponse(context);
    const parsed = coachOutputSchema.safeParse(raw);
    if (!parsed.success) continue;

    const guardrail = runCoachGuardrails(parsed.data, {
      currentStage: stage,
      userText,
      recentQuestions,
    });
    if (guardrail.ok) {
      return { output: guardrail.output, status: "ok" };
    }
  }

  return {
    output: {
      currentStage: stage,
      action: "fallback",
      coachMessage: "",
      question: getFallbackQuestion(stage, hintLevel),
      detectedGaps: [],
      evidenceReferences: [],
      hintLevel,
      suggestedNextStage: null,
      safetyFlags: [],
    },
    status: "fallback",
    errorCode: "guardrail_or_schema_failed",
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;
  const { supabase, userId, repos } = ctx;

  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) return apiError("validation_error", parsed.error.issues[0]?.message);
  const { hintLevel, clientRequestId } = parsed.data;

  return withIdempotency(supabase, userId, clientRequestId, async () => {
    const current = await loadOwnedSnapshot(repos, sessionId, userId);
    if (!current) return apiError("not_found");

    const stage = current.session.currentStage;
    if (stage === "not_started" || !hasMinimalUserInput(stage, current)) {
      return apiError(
        "requirement_not_met",
        "먼저 이 단계에 직접 작성한 뒤에 AI 코칭을 요청할 수 있어요.",
      );
    }

    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.ok) {
      return apiError(
        "validation_error",
        "너무 빠르게 요청했어요. 잠시 후 다시 시도해주세요.",
      );
    }

    const context = buildCoachContext(stage, current, hintLevel);
    const startedAt = Date.now();

    let output: CoachOutputSchema;
    let status: "ok" | "fallback" | "error";
    let errorCode: string | undefined;

    if (current.session.aiCallCount >= SESSION_AI_CALL_CAP) {
      output = {
        currentStage: stage,
        action: "fallback",
        coachMessage: "",
        question: getFallbackQuestion(stage, hintLevel),
        detectedGaps: [],
        evidenceReferences: [],
        hintLevel,
        suggestedNextStage: null,
        safetyFlags: [],
      };
      status = "fallback";
      errorCode = "session_call_cap_reached";
    } else {
      const result = await getValidatedCoachOutput(
        stage,
        hintLevel,
        context.userText,
        context.recentQuestions ?? [],
      );
      output = result.output;
      status = result.status;
      errorCode = result.errorCode;
    }

    const provider = getActiveCoachProvider();
    const interaction: CoachInteraction = {
      id: crypto.randomUUID(),
      sessionId: current.session.id,
      stage,
      validatedOutput: output,
      action: output.action,
      hintLevel,
      provider: provider.provider,
      model: provider.model,
      promptVersion: provider.promptVersion,
      schemaVersion: provider.schemaVersion,
      latencyMs: Date.now() - startedAt,
      status: status === "ok" ? "ok" : "fallback",
      errorCode,
      isStale: false,
      createdAt: new Date().toISOString(),
    };

    const saved = await repos.sessionRepository.saveSnapshot({
      ...current,
      coachInteractions: [...current.coachInteractions, interaction],
      session: { ...current.session, aiCallCount: current.session.aiCallCount + 1 },
    });

    return NextResponse.json({ question: output.question, snapshot: saved });
  });
}
