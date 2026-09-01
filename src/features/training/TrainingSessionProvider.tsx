"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type { ReactNode } from "react";
import type {
  AIFeedback,
  HintLevel,
  TrainingSessionSnapshot,
  TrainingTemplate,
} from "@/domain/types";
import type {
  ObservationDraft,
  ObservationItemDraft,
  PerspectiveDraft,
  ProblemDefinitionDraft,
  QuestionDraft,
  ReframeDraft,
} from "@/domain/training/builders";
import { canAdvance as computeCanAdvance } from "@/domain/training/state-machine";
import { STAGE_ORDER } from "@/domain/training/stages";
import { EXCEPTION_PROMPT_KEYS } from "@/domain/training/requirements";
import {
  clearSessionDrafts,
  createDebouncedDraftSaver,
  deleteDraft,
  getDraft,
  getDraftsForSession,
  type DraftRecord,
} from "@/lib/persistence/drafts";
import { findConflictingDrafts } from "@/lib/persistence/reconciliation";
import type { MutateAction } from "@/lib/schemas/mutate-actions";
import type {
  explorationPromptKeySchema,
  SelfAssessmentInput,
} from "@/lib/schemas/stage-input";
import type { z } from "zod";

/**
 * Phase 3부터는 실제 로그인 사용자의 브라우저 시간대를 쓴다 — §14-C 이전까지 썼던
 * 고정 Mock 값은 폐기됐다. userId는 서버가 세션 쿠키에서 얻으므로 클라이언트가
 * 보낼 필요가 없다(DEVELOPMENT_PLAN.md §6.3 원칙 6).
 */
function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

interface ApiErrorBody {
  errorCode: string;
  message: string;
  snapshot?: TrainingSessionSnapshot;
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

interface State {
  status: "loading" | "ready" | "error";
  snapshot: TrainingSessionSnapshot | null;
  template: TrainingTemplate | null;
  errorMessage: string | null;
  conflictingDrafts: DraftRecord[];
}

type Action =
  | { type: "loading" }
  | { type: "ready"; snapshot: TrainingSessionSnapshot; template: TrainingTemplate | null; conflictingDrafts: DraftRecord[] }
  | { type: "snapshotUpdated"; snapshot: TrainingSessionSnapshot }
  | { type: "conflictsUpdated"; conflictingDrafts: DraftRecord[] }
  | { type: "error"; message: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "loading":
      return { status: "loading", snapshot: null, template: null, errorMessage: null, conflictingDrafts: [] };
    case "ready":
      return {
        status: "ready",
        snapshot: action.snapshot,
        template: action.template,
        errorMessage: null,
        conflictingDrafts: action.conflictingDrafts,
      };
    case "snapshotUpdated":
      return { ...state, snapshot: action.snapshot };
    case "conflictsUpdated":
      return { ...state, conflictingDrafts: action.conflictingDrafts };
    case "error":
      return { ...state, status: "error", errorMessage: action.message };
  }
}

export interface TrainingSessionContextValue {
  status: State["status"];
  snapshot: TrainingSessionSnapshot | null;
  template: TrainingTemplate | null;
  errorMessage: string | null;
  canAdvance: boolean;
  conflictingDrafts: DraftRecord[];
  dismissConflictingDraft: (draft: DraftRecord) => Promise<void>;
  /**
   * mutate 큐가 비워질 때까지 기다린 뒤 그 시점의 스냅샷을 반환한다. 각 단계
   * 컴포넌트의 handlePrimaryAction이 "3개 이상 썼는가" 같은 조건을 React state
   * (`snapshot`)로 판단하면, 방금 클릭한 addQuestion/markPriorityQuestion이 아직
   * 큐에서 처리 중일 때 그 판단이 오래된 값을 볼 수 있다 — 실제 네트워크 왕복이 생긴
   * Phase 3부터 이 창이 커져 Playwright로 재현됐다(빠른 연속 클릭). 조건 판단 직전에
   * 이 함수로 큐 완료를 기다리면 항상 최신 값을 보게 된다.
   */
  awaitLatestSnapshot: () => Promise<TrainingSessionSnapshot | null>;
  advance: () => Promise<{ ok: true } | { ok: false; message: string }>;
  pause: () => Promise<void>;
  saveDraft: (promptKey: string, content: string) => void;
  loadDraft: (promptKey: string) => Promise<string | undefined>;
  submitObservation: (input: ObservationDraft) => Promise<void>;
  addObservationItem: (input: ObservationItemDraft) => Promise<void>;
  confirmObservationItem: (itemId: string, confirmed: boolean) => Promise<void>;
  addQuestion: (input: QuestionDraft, hintLevelUsed: HintLevel) => Promise<void>;
  markPriorityQuestion: (questionId: string, reason: string) => Promise<void>;
  addExplorationResponse: (promptKey: string, content: string) => Promise<void>;
  addPerspective: (input: PerspectiveDraft) => Promise<void>;
  addReframe: (input: ReframeDraft, hintLevelUsed: HintLevel) => Promise<void>;
  submitDefinition: (input: ProblemDefinitionDraft) => Promise<void>;
  submitExceptionReason: (
    promptKey: (typeof EXCEPTION_PROMPT_KEYS)[keyof typeof EXCEPTION_PROMPT_KEYS],
    content: string,
  ) => Promise<void>;
  completeSelfCheck: (assessments: SelfAssessmentInput["assessments"]) => Promise<void>;
  requestHint: (
    hintLevel: HintLevel,
  ) => Promise<{ ok: true; question: string } | { ok: false; message: string }>;
  requestFeedback: () => Promise<
    { ok: true; feedback: AIFeedback } | { ok: false; message: string }
  >;
}

const TrainingSessionContext = createContext<TrainingSessionContextValue | null>(null);

export function useTrainingSession(): TrainingSessionContextValue {
  const ctx = useContext(TrainingSessionContext);
  if (!ctx) {
    throw new Error("useTrainingSession은 TrainingSessionProvider 안에서만 쓸 수 있습니다.");
  }
  return ctx;
}

export function TrainingSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    status: "loading",
    snapshot: null,
    template: null,
    errorMessage: null,
    conflictingDrafts: [],
  });

  const debouncedSaveRef = useRef(createDebouncedDraftSaver(500));
  const timezoneRef = useRef(detectTimezone());

  /** stale closure 방지용 최신 스냅샷 캐시 — Phase 2부터 이어지는 패턴(원칙 7). */
  const snapshotRef = useRef<TrainingSessionSnapshot | null>(null);

  const commit = useCallback((snapshot: TrainingSessionSnapshot) => {
    snapshotRef.current = snapshot;
    dispatch({ type: "snapshotUpdated", snapshot });
  }, []);

  /**
   * 서버 왕복이 생겼으니 겹쳐 호출될 위험은 Phase 2보다 더 커졌다 — 큐로 직렬화하는
   * 이유는 그대로다(연속 클릭 시 먼저 온 응답이 늦게 온 요청의 스냅샷을 덮어쓰는 것 방지).
   */
  const mutationQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = mutationQueueRef.current.then(task, task);
    mutationQueueRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }, []);

  const callMutate = useCallback(
    (mutation: MutateAction): Promise<TrainingSessionSnapshot | null> =>
      enqueue(async () => {
        const current = snapshotRef.current;
        if (!current) return null;
        const response = await fetch(`/api/sessions/${current.session.id}/mutate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientRequestId: crypto.randomUUID(), mutation }),
        });
        const body = await parseJsonSafe<{ snapshot: TrainingSessionSnapshot }>(response);
        if (!response.ok || !body) return current;
        commit(body.snapshot);
        return body.snapshot;
      }),
    [enqueue, commit],
  );

  const canAdvance = useMemo(
    () => (state.snapshot ? computeCanAdvance(state.snapshot) : false),
    [state.snapshot],
  );

  const callTransition = useCallback(
    (endpoint: "advance" | "pause" | "resume" | "abandon"): Promise<{ ok: true } | { ok: false; message: string }> =>
      enqueue(async () => {
        const current = snapshotRef.current;
        if (!current) return { ok: false, message: "세션이 아직 준비되지 않았습니다." };

        if (endpoint === "advance") {
          debouncedSaveRef.current.cancelPending();
          await clearSessionDrafts(current.session.id);
        }

        const response = await fetch(`/api/sessions/${current.session.id}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedStateVersion: current.session.stateVersion,
            clientRequestId: crypto.randomUUID(),
          }),
        });
        const body = await parseJsonSafe<{ snapshot: TrainingSessionSnapshot } & Partial<ApiErrorBody>>(
          response,
        );
        if (!body) return { ok: false, message: "저장하지 못했습니다. 작성한 내용은 그대로 있어요." };

        // 실패 응답도 서버가 함께 보내주는 최신 스냅샷으로 갱신한다 — 다른 기기가 먼저
        // 진행시킨 경우 이 기기도 그 최신 상태를 즉시 보게 된다(§7.3 409 규약).
        const returnedSnapshot = "snapshot" in body ? body.snapshot : undefined;
        if (returnedSnapshot) commit(returnedSnapshot);

        if (!response.ok) {
          return { ok: false, message: body.message ?? "지금은 이 동작을 할 수 없어요." };
        }
        return { ok: true };
      }),
    [enqueue, commit],
  );

  const awaitLatestSnapshot = useCallback(
    () => enqueue(async () => snapshotRef.current),
    [enqueue],
  );

  const advance = useCallback(() => callTransition("advance"), [callTransition]);
  const pause = useCallback(async () => {
    await callTransition("pause");
  }, [callTransition]);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplateFor(session: TrainingSessionSnapshot["session"]) {
      const res = await fetch("/api/templates");
      const body = await parseJsonSafe<{ templates: TrainingTemplate[] }>(res);
      return body?.templates.find((t) => t.id === session.templateId) ?? null;
    }

    async function init() {
      dispatch({ type: "loading" });
      try {
        const activeRes = await fetch("/api/sessions?status=active");
        const activeBody = await parseJsonSafe<{ snapshot: TrainingSessionSnapshot | null }>(activeRes);
        let snapshot = activeBody?.snapshot ?? null;

        if (!snapshot) {
          const timezone = timezoneRef.current;
          const todayRes = await fetch(`/api/templates/today?timezone=${encodeURIComponent(timezone)}`);
          const todayBody = await parseJsonSafe<{ template: TrainingTemplate }>(todayRes);
          if (!todayBody) throw new Error("오늘의 렌즈를 불러오지 못했습니다.");

          const createRes = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientGeneratedId: crypto.randomUUID(),
              templateId: todayBody.template.id,
              timezone,
              clientRequestId: crypto.randomUUID(),
            }),
          });
          const createBody = await parseJsonSafe<{ snapshot: TrainingSessionSnapshot }>(createRes);
          if (!createRes.ok || !createBody) throw new Error("세션을 시작하지 못했습니다.");
          snapshot = createBody.snapshot;
        } else if (snapshot.session.status === "paused") {
          // /training 진입 자체가 "이어서 하기" 행동이다.
          const resumeRes = await fetch(`/api/sessions/${snapshot.session.id}/resume`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              expectedStateVersion: snapshot.session.stateVersion,
              clientRequestId: crypto.randomUUID(),
            }),
          });
          const resumeBody = await parseJsonSafe<{ snapshot: TrainingSessionSnapshot }>(resumeRes);
          if (resumeBody) snapshot = resumeBody.snapshot;
        }

        const template = await loadTemplateFor(snapshot.session);
        const localDrafts = await getDraftsForSession(snapshot.session.id);
        const conflictingDrafts = findConflictingDrafts(
          localDrafts,
          snapshot.session.currentStage,
          STAGE_ORDER,
        );

        if (!cancelled) {
          snapshotRef.current = snapshot;
          dispatch({ type: "ready", snapshot, template, conflictingDrafts });
        }
      } catch (err) {
        if (!cancelled) {
          dispatch({
            type: "error",
            message: err instanceof Error ? err.message : "세션을 불러오지 못했습니다.",
          });
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissConflictingDraft = useCallback(async (draft: DraftRecord) => {
    await deleteDraft(draft.sessionId, draft.stage, draft.promptKey);
    dispatch({
      type: "conflictsUpdated",
      conflictingDrafts: (snapshotRef.current
        ? await getDraftsForSession(snapshotRef.current.session.id)
        : []
      ).filter((d) => !(d.stage === draft.stage && d.promptKey === draft.promptKey)),
    });
  }, []);

  const saveDraft = useCallback((promptKey: string, content: string) => {
    const current = snapshotRef.current;
    if (!current) return;
    debouncedSaveRef.current({
      sessionId: current.session.id,
      stage: current.session.currentStage,
      promptKey,
      content,
    });
  }, []);

  const loadDraft = useCallback(async (promptKey: string) => {
    const current = snapshotRef.current;
    if (!current) return undefined;
    const draft = await getDraft(current.session.id, current.session.currentStage, promptKey);
    return draft?.content;
  }, []);

  const submitObservation = useCallback(
    async (input: ObservationDraft) => {
      await callMutate({ action: "submitObservation", args: input });
    },
    [callMutate],
  );

  const addObservationItem = useCallback(
    async (input: ObservationItemDraft) => {
      await callMutate({ action: "addObservationItem", args: input });
    },
    [callMutate],
  );

  const confirmObservationItem = useCallback(
    async (itemId: string, confirmed: boolean) => {
      await callMutate({ action: "confirmObservationItem", args: { itemId, confirmed } });
    },
    [callMutate],
  );

  const addQuestion = useCallback(
    async (input: QuestionDraft, hintLevelUsed: HintLevel) => {
      await callMutate({ action: "addQuestion", args: { input, hintLevelUsed } });
    },
    [callMutate],
  );

  const markPriorityQuestion = useCallback(
    async (questionId: string, reason: string) => {
      await callMutate({
        action: "markPriorityQuestion",
        args: { questionId, priorityReason: reason },
      });
    },
    [callMutate],
  );

  const addExplorationResponse = useCallback(
    async (promptKey: string, content: string) => {
      await callMutate({
        action: "addExplorationResponse",
        args: { promptKey: promptKey as z.infer<typeof explorationPromptKeySchema>, content },
      });
    },
    [callMutate],
  );

  const addPerspective = useCallback(
    async (input: PerspectiveDraft) => {
      await callMutate({ action: "addPerspective", args: input });
    },
    [callMutate],
  );

  const addReframe = useCallback(
    async (input: ReframeDraft, hintLevelUsed: HintLevel) => {
      await callMutate({ action: "addReframe", args: { input, hintLevelUsed } });
    },
    [callMutate],
  );

  const submitDefinition = useCallback(
    async (input: ProblemDefinitionDraft) => {
      await callMutate({ action: "submitDefinition", args: input });
    },
    [callMutate],
  );

  const submitExceptionReason = useCallback(
    async (
      promptKey: (typeof EXCEPTION_PROMPT_KEYS)[keyof typeof EXCEPTION_PROMPT_KEYS],
      content: string,
    ) => {
      await callMutate({ action: "submitExceptionReason", args: { promptKey, content } });
    },
    [callMutate],
  );

  const completeSelfCheck = useCallback(
    async (assessments: SelfAssessmentInput["assessments"]) => {
      await callMutate({ action: "completeSelfCheck", args: { assessments } });
    },
    [callMutate],
  );

  const requestHint = useCallback(
    (
      hintLevel: HintLevel,
    ): Promise<{ ok: true; question: string } | { ok: false; message: string }> =>
      enqueue(async () => {
        const current = snapshotRef.current;
        if (!current) return { ok: false, message: "세션이 아직 준비되지 않았습니다." };
        const response = await fetch(`/api/sessions/${current.session.id}/coach`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hintLevel, clientRequestId: crypto.randomUUID() }),
        });
        const body = await parseJsonSafe<
          { question: string | null; snapshot: TrainingSessionSnapshot } & Partial<ApiErrorBody>
        >(response);
        if (!response.ok || !body) {
          return { ok: false, message: body?.message ?? "힌트를 가져오지 못했어요." };
        }
        commit(body.snapshot);
        return { ok: true, question: body.question ?? "" };
      }),
    [enqueue, commit],
  );

  const requestFeedback = useCallback(
    (): Promise<{ ok: true; feedback: AIFeedback } | { ok: false; message: string }> =>
      enqueue(async () => {
        const current = snapshotRef.current;
        if (!current) return { ok: false, message: "세션이 아직 준비되지 않았습니다." };
        const response = await fetch(`/api/sessions/${current.session.id}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientRequestId: crypto.randomUUID() }),
        });
        const body = await parseJsonSafe<
          | { feedback: AIFeedback; snapshot: TrainingSessionSnapshot }
          | { errorCode: string; message: string }
        >(response);
        if (!response.ok || !body || !("feedback" in body)) {
          return {
            ok: false,
            message: body && "message" in body ? body.message : "AI 피드백을 지금은 만들 수 없어요.",
          };
        }
        commit(body.snapshot);
        return { ok: true, feedback: body.feedback };
      }),
    [enqueue, commit],
  );

  const value: TrainingSessionContextValue = {
    status: state.status,
    snapshot: state.snapshot,
    template: state.template,
    errorMessage: state.errorMessage,
    canAdvance,
    conflictingDrafts: state.conflictingDrafts,
    dismissConflictingDraft,
    awaitLatestSnapshot,
    advance,
    pause,
    saveDraft,
    loadDraft,
    submitObservation,
    addObservationItem,
    confirmObservationItem,
    addQuestion,
    markPriorityQuestion,
    addExplorationResponse,
    addPerspective,
    addReframe,
    submitDefinition,
    submitExceptionReason,
    completeSelfCheck,
    requestHint,
    requestFeedback,
  };

  return <TrainingSessionContext.Provider value={value}>{children}</TrainingSessionContext.Provider>;
}
