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
import { EXCEPTION_PROMPT_KEYS, isSoloModeSession } from "@/domain/training/requirements";
import {
  clearSessionDrafts,
  createDebouncedDraftSaver,
  deleteDraft,
  getDraft,
  getDraftsForSession,
  type DraftRecord,
} from "@/lib/persistence/drafts";
import { findConflictingDrafts } from "@/lib/persistence/reconciliation";
import { handleUnauthorized, toDisplayMessage, UserFacingError } from "@/lib/fetch-json";
import { trackedFetch } from "@/lib/network-status";
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
  | {
      type: "ready";
      snapshot: TrainingSessionSnapshot;
      template: TrainingTemplate | null;
      conflictingDrafts: DraftRecord[];
    }
  | { type: "snapshotUpdated"; snapshot: TrainingSessionSnapshot }
  | { type: "conflictsUpdated"; conflictingDrafts: DraftRecord[] }
  | { type: "error"; message: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "loading":
      return {
        status: "loading",
        snapshot: null,
        template: null,
        errorMessage: null,
        conflictingDrafts: [],
      };
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
  /** "오늘은 혼자 해보기" (P1-6). 켜면 이 세션에서 AI 도움을 쓰지 않는다. */
  enableSoloMode: () => Promise<void>;
  /** 이 세션이 혼자 하기로 선택된 상태인가. */
  isSoloMode: boolean;
  /** `ok: true`의 question은 항상 공백이 아니다 — 빈 응답은 실패로 변환된다. */
  requestHint: (
    hintLevel: HintLevel,
  ) => Promise<
    { ok: true; question: string; notice?: string } | { ok: false; message: string }
  >;
  requestFeedback: () => Promise<
    { ok: true; feedback: AIFeedback } | { ok: false; message: string }
  >;
}

const TrainingSessionContext = createContext<TrainingSessionContextValue | null>(null);

export function useTrainingSession(): TrainingSessionContextValue {
  const ctx = useContext(TrainingSessionContext);
  if (!ctx) {
    throw new Error(
      "useTrainingSession은 TrainingSessionProvider 안에서만 쓸 수 있습니다.",
    );
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
        const response = await trackedFetch(
          `/api/sessions/${current.session.id}/mutate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientRequestId: crypto.randomUUID(), mutation }),
          },
        );
        const body = await parseJsonSafe<
          { snapshot: TrainingSessionSnapshot } & Partial<ApiErrorBody>
        >(response);

        // 실패 응답도 서버가 함께 보내주는 최신 스냅샷은 반영한다(§7.3 409 규약).
        if (body?.snapshot) commit(body.snapshot);

        // 세션이 풀렸으면 재시도로 풀리지 않는다 — 로그인 화면으로 보낸다.
        handleUnauthorized(response.status, body);

        if (!response.ok || !body) {
          // 예전에는 여기서 옛 스냅샷을 그대로 돌려줬다 — 호출자 입장에서 "아무것도
          // 바뀌지 않은 성공"과 구분이 되지 않아, 저장이 실패했는데도 곧바로
          // advance()로 넘어갔다. advance()는 로컬 초안을 지우므로 그 순간 사용자의
          // 입력이 서버에도 기기에도 없게 된다(원칙 7 위반). 실패는 실패로 알린다.
          // 사용자에게는 한국어 한 문장만 보이지만, 무엇이 실패했는지는 콘솔에 남긴다 —
          // 그러지 않으면 "저장하지 못했어요"만 보고 원인을 좁힐 방법이 없다.
          console.error(
            `[mutate] ${mutation.action} 실패 status=${response.status} bodyParsed=${body !== null}`,
          );
          throw new UserFacingError(
            body?.message ?? "저장하지 못했어요. 잠시 후 다시 시도해주세요.",
          );
        }
        return body.snapshot;
      }),
    [enqueue, commit],
  );

  const canAdvance = useMemo(
    () => (state.snapshot ? computeCanAdvance(state.snapshot) : false),
    [state.snapshot],
  );

  const callTransition = useCallback(
    (
      endpoint: "advance" | "pause" | "resume" | "abandon",
    ): Promise<{ ok: true } | { ok: false; message: string }> =>
      enqueue(async () => {
        const current = snapshotRef.current;
        if (!current) return { ok: false, message: "세션이 아직 준비되지 않았습니다." };

        if (endpoint === "advance") {
          // 대기 중인 debounce 저장만 미리 취소한다. 그대로 두면 전환 뒤에 뒤늦게
          // 발동해 이미 지나간 단계의 초안을 되살린다(E2E로 재현한 경쟁 상태).
          // 실제 삭제는 서버가 전환을 확정한 뒤에 한다 — 아래 주석 참고.
          debouncedSaveRef.current.cancelPending();
        }

        const response = await trackedFetch(
          `/api/sessions/${current.session.id}/${endpoint}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              expectedStateVersion: current.session.stateVersion,
              clientRequestId: crypto.randomUUID(),
            }),
          },
        );
        const body = await parseJsonSafe<
          { snapshot: TrainingSessionSnapshot } & Partial<ApiErrorBody>
        >(response);
        if (!body)
          return {
            ok: false,
            message: "저장하지 못했어요. 작성한 내용은 그대로 있어요.",
          };

        // 실패 응답도 서버가 함께 보내주는 최신 스냅샷으로 갱신한다 — 다른 기기가 먼저
        // 진행시킨 경우 이 기기도 그 최신 상태를 즉시 보게 된다(§7.3 409 규약).
        const returnedSnapshot = "snapshot" in body ? body.snapshot : undefined;
        if (returnedSnapshot) commit(returnedSnapshot);

        if (!response.ok) {
          handleUnauthorized(response.status, body);
          return { ok: false, message: body.message ?? "지금은 이 동작을 할 수 없어요." };
        }

        // 초안 삭제는 여기까지 와야 안전하다. 예전에는 fetch 앞에서 지웠는데, 그
        // 사이에 서버 저장이 실패하면(예: 이 프로젝트에서 실제로 겪은 JWT 시각 오차
        // 500) 입력이 서버에도 기기에도 남지 않았다 — 그런데도 화면에는 "작성한
        // 내용은 그대로 있어요"가 떴다. 정리 실패가 성공한 전환을 오류로 뒤집지는
        // 않게 감싼다(남은 초안은 다음 성공한 전환에서 정리된다).
        if (endpoint === "advance") {
          try {
            await clearSessionDrafts(current.session.id);
          } catch {
            // 무시한다 — 초안이 남는 것은 입력을 잃는 것보다 훨씬 가벼운 문제다.
          }
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

    /*
      템플릿 목록은 세션과 **동시에** 받는다. 예전에는 세션을 다 만든 뒤에 받았는데,
      목록 조회는 세션이 무엇인지 전혀 몰라도 되는 요청이다 — 필요한 것은 마지막에
      `find`할 때뿐이다. 순서대로 기다릴 이유가 없는 왕복이 하나 줄었다.

      실패해도 이름만 비우고 화면은 정상적으로 보여준다(렌즈 이름은 보조 정보다).
    */
    const templatesPromise = trackedFetch("/api/templates")
      .then((res) => parseJsonSafe<{ templates: TrainingTemplate[] }>(res))
      .catch(() => null);

    async function loadTemplateFor(session: TrainingSessionSnapshot["session"]) {
      const body = await templatesPromise;
      return body?.templates.find((t) => t.id === session.templateId) ?? null;
    }

    async function init() {
      dispatch({ type: "loading" });
      try {
        const activeRes = await trackedFetch("/api/sessions?status=active");
        const activeBody = await parseJsonSafe<{
          snapshot: TrainingSessionSnapshot | null;
        }>(activeRes);
        let snapshot = activeBody?.snapshot ?? null;

        if (!snapshot) {
          const timezone = timezoneRef.current;
          /*
            오늘의 렌즈를 먼저 물어보고 그 답을 실어 보내지 않는다. 고르는 규칙은
            (날짜, 사용자)만 있으면 정해지는 결정론적 함수라 서버도 똑같이 고를 수
            있고, 그러면 시작 버튼을 누른 뒤 기다리는 왕복이 하나 줄어든다.
          */
          const createRes = await trackedFetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientGeneratedId: crypto.randomUUID(),
              timezone,
              clientRequestId: crypto.randomUUID(),
            }),
          });
          const createBody = await parseJsonSafe<{ snapshot: TrainingSessionSnapshot }>(
            createRes,
          );
          if (!createRes.ok || !createBody)
            throw new UserFacingError(
              "훈련을 시작하지 못했어요. 잠시 후 다시 시도해주세요.",
            );
          snapshot = createBody.snapshot;
        } else if (snapshot.session.status === "paused") {
          // /training 진입 자체가 "이어서 하기" 행동이다.
          const resumeRes = await trackedFetch(
            `/api/sessions/${snapshot.session.id}/resume`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                expectedStateVersion: snapshot.session.stateVersion,
                clientRequestId: crypto.randomUUID(),
              }),
            },
          );
          const resumeBody = await parseJsonSafe<{ snapshot: TrainingSessionSnapshot }>(
            resumeRes,
          );
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
            // 우리가 쓴 안내는 살리고, 브라우저 예외는 한국어 문장으로 바꾼다.
            message: toDisplayMessage(err),
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
    const draft = await getDraft(
      current.session.id,
      current.session.currentStage,
      promptKey,
    );
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
        args: {
          promptKey: promptKey as z.infer<typeof explorationPromptKeySchema>,
          content,
        },
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

  const enableSoloMode = useCallback(async () => {
    await callMutate({ action: "enableSoloMode", args: {} });
  }, [callMutate]);

  const requestHint = useCallback(
    (
      hintLevel: HintLevel,
    ): Promise<
      { ok: true; question: string; notice?: string } | { ok: false; message: string }
    > =>
      enqueue(async () => {
        const current = snapshotRef.current;
        if (!current) return { ok: false, message: "세션이 아직 준비되지 않았습니다." };
        const response = await trackedFetch(`/api/sessions/${current.session.id}/coach`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hintLevel, clientRequestId: crypto.randomUUID() }),
        });
        const body = await parseJsonSafe<
          {
            question: string | null;
            snapshot: TrainingSessionSnapshot;
            notice?: string;
          } & Partial<ApiErrorBody>
        >(response);
        if (!response.ok || !body) {
          return {
            ok: false,
            message: body?.message ?? "힌트를 가져오지 못했어요.",
          };
        }
        commit(body.snapshot);

        // 성공 응답인데 질문이 비어 있으면 실패로 돌린다. 서버는 action:"ask"에
        // 질문이 없는 응답을 Guardrail(checkAskHasQuestion)로 막지만, 그 방어가
        // 뚫리면 화면에는 오류도 힌트도 없이 아무것도 뜨지 않는다 — 이 프로젝트에서
        // 세 번 반복된 "힌트 버튼이 침묵한다" 증상이 정확히 그 모양이었다.
        // 보여줄 것이 없는 성공은 호출자에게 성공이 아니므로 여기서 걸러낸다.
        const question = body.question?.trim() ?? "";
        if (!question) {
          return {
            ok: false,
            message: "힌트를 받지 못했어요. 잠시 후 다시 시도해주세요.",
          };
        }
        return { ok: true, question, notice: body.notice };
      }),
    [enqueue, commit],
  );

  const requestFeedback = useCallback(
    (): Promise<{ ok: true; feedback: AIFeedback } | { ok: false; message: string }> =>
      enqueue(async () => {
        const current = snapshotRef.current;
        if (!current) return { ok: false, message: "세션이 아직 준비되지 않았습니다." };
        const response = await trackedFetch(
          `/api/sessions/${current.session.id}/feedback`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientRequestId: crypto.randomUUID() }),
          },
        );
        const body = await parseJsonSafe<
          | { feedback: AIFeedback; snapshot: TrainingSessionSnapshot }
          | { errorCode: string; message: string }
        >(response);
        if (!response.ok || !body || !("feedback" in body)) {
          return {
            ok: false,
            message:
              body && "message" in body
                ? body.message
                : "AI 피드백을 지금은 만들 수 없어요.",
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
    enableSoloMode,
    isSoloMode: state.snapshot ? isSoloModeSession(state.snapshot) : false,
    requestHint,
    requestFeedback,
  };

  return (
    <TrainingSessionContext.Provider value={value}>
      {children}
    </TrainingSessionContext.Provider>
  );
}
