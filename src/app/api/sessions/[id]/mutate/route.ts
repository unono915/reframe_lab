import { NextResponse, type NextRequest } from "next/server";
import type { TrainingSessionSnapshot } from "@/domain/types";
import {
  buildObservation,
  buildObservationItem,
  buildPerspective,
  buildProblemDefinitionVersion,
  buildQuestion,
  buildReframe,
  buildStageResponse,
} from "@/domain/training/builders";
import { FEEDBACK_SELF_CHECK_PROMPT_KEY } from "@/domain/training/requirements";
import { selfAssessmentPromptKey } from "@/domain/training/self-assessment";
import { applyStaleness, computeStaleArtifacts } from "@/domain/training/staleness";
import { mutateRequestSchema, type MutateAction } from "@/lib/schemas/mutate-actions";
import { apiError } from "@/lib/errors";
import { createRouteContext, loadOwnedSnapshot, withIdempotency } from "../../../_lib/route-context";

function propagateStalenessIfEditingPastStage(
  current: TrainingSessionSnapshot,
  editedStage: TrainingSessionSnapshot["session"]["currentStage"],
): TrainingSessionSnapshot {
  if (editedStage === current.session.currentStage) return current;
  const computation = computeStaleArtifacts(editedStage, current);
  const patch = applyStaleness(current, computation);
  return { ...current, ...patch };
}

/**
 * 화이트리스트에 있는 액션만 실행한다(mutate-actions.ts). 각 case는
 * `TrainingSessionProvider`의 같은 이름 함수가 클라이언트에서 하던 것과 동일한
 * domain builder 호출을 서버에서 그대로 한다 — id·시각 부여를 서버가 맡는다.
 */
function applyMutation(
  current: TrainingSessionSnapshot,
  mutation: MutateAction,
): TrainingSessionSnapshot {
  switch (mutation.action) {
    case "submitObservation": {
      const observation = buildObservation(current.session.id, mutation.args, current.observation);
      const withStale = propagateStalenessIfEditingPastStage(current, "observation");
      return { ...withStale, observation };
    }
    case "addObservationItem": {
      if (!current.observation) return current;
      const withStale = propagateStalenessIfEditingPastStage(current, "separation");
      const item = buildObservationItem(
        current.observation.id,
        mutation.args,
        withStale.observationItems.length,
      );
      return { ...withStale, observationItems: [...withStale.observationItems, item] };
    }
    case "confirmObservationItem": {
      const { itemId, confirmed } = mutation.args;
      const withStale = propagateStalenessIfEditingPastStage(current, "separation");
      return {
        ...withStale,
        observationItems: withStale.observationItems.map((item) =>
          item.id === itemId ? { ...item, userConfirmed: confirmed } : item,
        ),
      };
    }
    case "addQuestion": {
      const withStale = propagateStalenessIfEditingPastStage(current, "questioning");
      const question = {
        ...buildQuestion(current.session.id, mutation.args.input, withStale.questions.length),
        hintLevelUsed: mutation.args.hintLevelUsed,
      };
      return { ...withStale, questions: [...withStale.questions, question] };
    }
    case "markPriorityQuestion": {
      const { questionId, priorityReason } = mutation.args;
      const withStale = propagateStalenessIfEditingPastStage(current, "questioning");
      return {
        ...withStale,
        questions: withStale.questions.map((q) =>
          q.id === questionId
            ? { ...q, isPriority: true, priorityReason }
            : { ...q, isPriority: false, priorityReason: undefined },
        ),
      };
    }
    case "addExplorationResponse": {
      const withStale = propagateStalenessIfEditingPastStage(current, "exploration");
      const response = buildStageResponse(current.session.id, "exploration", mutation.args);
      const withoutOld = withStale.stageResponses.filter(
        (r) => !(r.stage === "exploration" && r.promptKey === mutation.args.promptKey),
      );
      return { ...withStale, stageResponses: [...withoutOld, response] };
    }
    case "addPerspective": {
      const withStale = propagateStalenessIfEditingPastStage(current, "reframing");
      const perspective = buildPerspective(
        current.session.id,
        mutation.args,
        withStale.perspectives.length,
      );
      return { ...withStale, perspectives: [...withStale.perspectives, perspective] };
    }
    case "addReframe": {
      const withStale = propagateStalenessIfEditingPastStage(current, "reframing");
      const reframe = buildReframe(current.session.id, mutation.args.input, withStale.reframes.length);
      return { ...withStale, reframes: [...withStale.reframes, reframe] };
    }
    case "submitDefinition": {
      const version = buildProblemDefinitionVersion(
        current.session.id,
        mutation.args,
        current.problemDefinitionVersions,
      );
      const withStale = propagateStalenessIfEditingPastStage(current, "definition");
      return {
        ...withStale,
        problemDefinitionVersions: [...withStale.problemDefinitionVersions, version],
      };
    }
    case "submitExceptionReason": {
      const response = buildStageResponse(
        current.session.id,
        current.session.currentStage,
        mutation.args,
      );
      return { ...current, stageResponses: [...current.stageResponses, response] };
    }
    case "completeSelfCheck": {
      // 차원별 판단 6개 + 기존 완료 표시 1개를 함께 남긴다. 완료 표시를 계속 쓰는
      // 이유는 `requirements.ts checkFeedback`이 이 promptKey로 완료를 판정하기
      // 때문이다 — 자기 점검을 정규 단계로 올리면서도 그 계약은 건드리지 않는다.
      const dimensionResponses = mutation.args.assessments.map((assessment) =>
        buildStageResponse(current.session.id, "feedback", {
          promptKey: selfAssessmentPromptKey(assessment.key),
          content: assessment.status,
        }),
      );
      const completionMarker = buildStageResponse(current.session.id, "feedback", {
        promptKey: FEEDBACK_SELF_CHECK_PROMPT_KEY,
        content: "confirmed",
      });
      // 다시 답하면 이전 판단을 남기지 않고 교체한다 — 대조표가 어느 것을 봐야 할지
      // 모호해지면 안 된다(exploration의 promptKey 교체와 같은 방식).
      const replacedKeys = new Set([
        ...dimensionResponses.map((r) => r.promptKey),
        FEEDBACK_SELF_CHECK_PROMPT_KEY,
      ]);
      const withoutOld = current.stageResponses.filter(
        (r) => !(r.stage === "feedback" && replacedKeys.has(r.promptKey)),
      );
      return {
        ...current,
        stageResponses: [...withoutOld, ...dimensionResponses, completionMarker],
      };
    }
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const ctx = await createRouteContext();
  if (!ctx.ok) return ctx.response;
  const { supabase, userId, repos } = ctx;

  const json = await request.json().catch(() => null);
  const parsed = mutateRequestSchema.safeParse(json);
  if (!parsed.success) {
    return apiError("validation_error", parsed.error.issues[0]?.message);
  }
  const { clientRequestId, mutation } = parsed.data;

  return withIdempotency(supabase, userId, clientRequestId, async () => {
    const current = await loadOwnedSnapshot(repos, sessionId, userId);
    if (!current) return apiError("not_found");

    const next = applyMutation(current, mutation);
    const saved = await repos.sessionRepository.saveSnapshot(next);
    return NextResponse.json({ snapshot: saved });
  });
}
