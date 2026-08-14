import type { Stage, TrainingSession, TrainingSessionSnapshot } from "@/domain/types";
import { checkStageRequirement } from "./requirements";
import { nextStageOf } from "./stages";

export type TransitionErrorCode =
  "wrong_state_version" | "requirement_not_met" | "invalid_transition";

export type TransitionResult =
  | { ok: true; session: TrainingSession; viaException: boolean }
  | { ok: false; errorCode: TransitionErrorCode; message: string };

function withNewVersion(
  session: TrainingSession,
  patch: Partial<TrainingSession>,
): TrainingSession {
  return {
    ...session,
    ...patch,
    stateVersion: session.stateVersion + 1,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 클라이언트도 이 함수로 버튼 활성/비활성을 계산한다 — 단, 이건 UX용이며 보안 경계가
 * 아니다(DEVELOPMENT_PLAN.md §7.3). 실제 저장은 서버가 같은 함수로 다시 검증한 뒤에만 일어난다.
 */
export function canAdvance(snapshot: TrainingSessionSnapshot): boolean {
  const { session } = snapshot;
  if (session.status !== session.currentStage) return false; // paused/abandoned/completed 등
  return checkStageRequirement(session.currentStage, snapshot).met;
}

/**
 * 현재 단계 산출물을 검사해 다음 단계로 전환한다. `feedback`의 다음은 Stage가 아니라
 * 종료 상태 `completed`다(PRD §12.2).
 *
 * 호출 순서는 DEVELOPMENT_PLAN.md §7.3의 서버 검사 6~7단계에 대응한다:
 * stateVersion 검증(4) → requirements.check(6) → 저장 + stateVersion++ + 전환(7).
 * 1~3(인증·소유권·idempotency)과 5(Zod)는 이 함수의 호출자(Route Handler/Repository) 책임이다.
 */
export function advanceStage(
  snapshot: TrainingSessionSnapshot,
  expectedStateVersion: number,
): TransitionResult {
  const { session } = snapshot;

  if (session.stateVersion !== expectedStateVersion) {
    return {
      ok: false,
      errorCode: "wrong_state_version",
      message: `요청한 stateVersion(${expectedStateVersion})이 현재(${session.stateVersion})와 다릅니다.`,
    };
  }

  if (session.status !== session.currentStage) {
    return {
      ok: false,
      errorCode: "invalid_transition",
      message: `현재 상태(${session.status})에서는 단계를 진행할 수 없습니다.`,
    };
  }

  const check = checkStageRequirement(session.currentStage, snapshot);
  if (!check.met) {
    return {
      ok: false,
      errorCode: "requirement_not_met",
      message: `'${session.currentStage}' 단계의 완료 조건이 아직 충족되지 않았습니다.`,
    };
  }

  const next = nextStageOf(session.currentStage);
  if (next) {
    return {
      ok: true,
      viaException: check.viaException,
      session: withNewVersion(session, { currentStage: next, status: next }),
    };
  }

  // currentStage === 'feedback'이고 다음 Stage가 없다 → 세션 완료.
  return {
    ok: true,
    viaException: check.viaException,
    session: withNewVersion(session, {
      status: "completed",
      completedAt: new Date().toISOString(),
    }),
  };
}

const ACTIVE_STATUSES = new Set<Stage | string>([
  "observation",
  "separation",
  "questioning",
  "exploration",
  "reframing",
  "definition",
  "feedback",
]);

export function pauseSession(
  session: TrainingSession,
  expectedStateVersion: number,
): TransitionResult {
  if (session.stateVersion !== expectedStateVersion) {
    return {
      ok: false,
      errorCode: "wrong_state_version",
      message: "stateVersion이 일치하지 않습니다.",
    };
  }
  if (!ACTIVE_STATUSES.has(session.status)) {
    return {
      ok: false,
      errorCode: "invalid_transition",
      message: "활성 단계에서만 보류할 수 있습니다.",
    };
  }
  return {
    ok: true,
    viaException: false,
    session: withNewVersion(session, {
      status: "paused",
      lastActiveStage: session.currentStage,
    }),
  };
}

export function resumeSession(
  session: TrainingSession,
  expectedStateVersion: number,
): TransitionResult {
  if (session.stateVersion !== expectedStateVersion) {
    return {
      ok: false,
      errorCode: "wrong_state_version",
      message: "stateVersion이 일치하지 않습니다.",
    };
  }
  if (session.status !== "paused" || !session.lastActiveStage) {
    return {
      ok: false,
      errorCode: "invalid_transition",
      message: "보류 상태에서만 이어서 할 수 있습니다.",
    };
  }
  return {
    ok: true,
    viaException: false,
    session: withNewVersion(session, { status: session.lastActiveStage }),
  };
}

export function abandonSession(
  session: TrainingSession,
  expectedStateVersion: number,
): TransitionResult {
  if (session.stateVersion !== expectedStateVersion) {
    return {
      ok: false,
      errorCode: "wrong_state_version",
      message: "stateVersion이 일치하지 않습니다.",
    };
  }
  if (session.status === "completed" || session.status === "abandoned") {
    return {
      ok: false,
      errorCode: "invalid_transition",
      message: "이미 종료된 세션입니다.",
    };
  }
  return {
    ok: true,
    viaException: false,
    session: withNewVersion(session, {
      status: "abandoned",
      abandonedAt: new Date().toISOString(),
    }),
  };
}
