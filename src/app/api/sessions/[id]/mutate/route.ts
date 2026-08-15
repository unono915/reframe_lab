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
      const item = buildObservationItem(
        current.observation.id,
        mutation.args,
        current.observationItems.length,
      );
      return { ...current, observationItems: [...current.observationItems, item] };
    }
    case "confirmObservationItem": {
      const { itemId, confirmed } = mutation.args;
      return {
        ...current,
        observationItems: current.observationItems.map((item) =>
          item.id === itemId ? { ...item, userConfirmed: confirmed } : item,
        ),
      };
    }
    case "addQuestion": {
      const question = {
        ...buildQuestion(current.session.id, mutation.args.input, current.questions.length),
        hintLevelUsed: mutation.args.hintLevelUsed,
      };
      return { ...current, questions: [...current.questions, question] };
    }
    case "markPriorityQuestion": {
      const { questionId, priorityReason } = mutation.args;
      return {
        ...current,
        questions: current.questions.map((q) =>
          q.id === questionId
            ? { ...q, isPriority: true, priorityReason }
            : { ...q, isPriority: false, priorityReason: undefined },
        ),
      };
    }
    case "addExplorationResponse": {
      const response = buildStageResponse(current.session.id, "exploration", mutation.args);
      const withoutOld = current.stageResponses.filter(
        (r) => !(r.stage === "exploration" && r.promptKey === mutation.args.promptKey),
      );
      return { ...current, stageResponses: [...withoutOld, response] };
    }
    case "addPerspective": {
      const perspective = buildPerspective(
        current.session.id,
        mutation.args,
        current.perspectives.length,
      );
      return { ...current, perspectives: [...current.perspectives, perspective] };
    }
    case "addReframe": {
      const reframe = buildReframe(current.session.id, mutation.args.input, current.reframes.length);
      return { ...current, reframes: [...current.reframes, reframe] };
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
      const response = buildStageResponse(current.session.id, "feedback", {
        promptKey: "self_checklist_completed",
        content: "confirmed",
      });
      return { ...current, stageResponses: [...current.stageResponses, response] };
    }
    case "recordCoachInteraction": {
      const { output, ...meta } = mutation.args;
      const interaction = {
        id: crypto.randomUUID(),
        sessionId: current.session.id,
        stage: current.session.currentStage,
        validatedOutput: output,
        action: output.action,
        ...meta,
        isStale: false,
        createdAt: new Date().toISOString(),
      };
      return {
        ...current,
        coachInteractions: [...current.coachInteractions, interaction],
        session: { ...current.session, aiCallCount: current.session.aiCallCount + 1 },
      };
    }
    case "recordAiFeedback": {
      const feedback = {
        id: crypto.randomUUID(),
        sessionId: current.session.id,
        ...mutation.args,
        isStale: false,
        createdAt: new Date().toISOString(),
      };
      return {
        ...current,
        aiFeedbacks: [...current.aiFeedbacks, feedback],
        session: { ...current.session, aiCallCount: current.session.aiCallCount + 1 },
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
