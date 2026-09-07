import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { CoachInteraction, Stage } from "@/domain/types";
import { hasMinimalUserInput } from "@/domain/training/requirements";
import { buildCoachContext } from "@/lib/ai/context";
import { getFallbackQuestion } from "@/lib/ai/fallback";
import { describeAiFailure, isUnretryableAiError } from "@/lib/ai/errors";
import { runCoachGuardrails } from "@/lib/ai/guardrails";
import type { CoachOutput } from "@/lib/ai/provider";
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

  // 마지막 시도가 왜 실패했는지를 기록에 남긴다. 예전에는 전부
  // `guardrail_or_schema_failed` 하나였는데, 그러면 fallback이 늘어도 **프롬프트를
  // 고쳐야 하는지 모델이 흔들리는지** 구분할 수 없다. 이 값이 나중에 코칭 품질을
  // 판단할 유일한 근거다.
  let lastFailure = "no_attempt";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let raw: CoachOutput | undefined;
    try {
      raw = await provider.getCoachResponse(context);
    } catch (error) {
      lastFailure = describeAiFailure(error);
      // 타임아웃은 다시 걸어도 같은 시간을 또 쓸 뿐이다 — 규칙 기반 fallback 질문으로
      // 바로 넘어가는 편이 사용자에게 훨씬 낫다(lib/ai/errors.ts).
      if (isUnretryableAiError(error)) break;
      continue;
    }
    const parsed = coachOutputSchema.safeParse(raw);
    if (!parsed.success) {
      lastFailure = "schema_invalid";
      continue;
    }

    const guardrail = runCoachGuardrails(parsed.data, {
      currentStage: stage,
      userText,
      recentQuestions,
    });
    if (guardrail.ok) {
      return { output: guardrail.output, status: "ok" };
    }
    // 어느 검사가 걸렸는지까지 남긴다 — "해결책 제안"이 잦으면 프롬프트 문제이고,
    // "반복 질문"이 잦으면 컨텍스트 구성 문제다. 대응이 서로 다르다.
    lastFailure = `guardrail:${guardrail.violations.join(",")}`;
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
    errorCode: lastFailure,
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

    // AI 호출은 최대 20초 걸린다. 그 사이 다른 기기·탭이 이 세션을 바꿨다면, 호출
    // 전에 읽어둔 `current`를 그대로 저장하는 순간 그 변경이 사라진다 —
    // `save_training_session_snapshot`은 낙관적 잠금 없이 자식 테이블을 지우고 다시
    // 넣는 방식이라(0003 마이그레이션), 오래된 스냅샷을 쓰면 그 뒤 저장된 질문·프레임이
    // 통째로 지워진다(원칙 7). 우리가 더하는 것은 코치 상호작용 1건과 호출 수 1 증가뿐이므로,
    // 저장 직전에 최신 스냅샷을 다시 읽어 거기에만 얹는다.
    const fresh = (await loadOwnedSnapshot(repos, sessionId, userId)) ?? current;
    const saved = await repos.sessionRepository.saveSnapshot({
      ...fresh,
      coachInteractions: [...fresh.coachInteractions, interaction],
      session: { ...fresh.session, aiCallCount: fresh.session.aiCallCount + 1 },
    });

    return NextResponse.json({ question: output.question, snapshot: saved });
  });
}
