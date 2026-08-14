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
  CoachInteraction,
  HintLevel,
  TrainingSessionSnapshot,
  TrainingTemplate,
} from "@/domain/types";
import {
  buildObservation,
  buildObservationItem,
  buildPerspective,
  buildProblemDefinitionVersion,
  buildQuestion,
  buildReframe,
  buildStageResponse,
  type ObservationDraft,
  type ObservationItemDraft,
  type PerspectiveDraft,
  type ProblemDefinitionDraft,
  type QuestionDraft,
  type ReframeDraft,
} from "@/domain/training/builders";
import {
  advanceStage,
  canAdvance as computeCanAdvance,
  pauseSession as pauseSessionTransition,
  resumeSession as resumeSessionTransition,
} from "@/domain/training/state-machine";
import { applyStaleness, computeStaleArtifacts } from "@/domain/training/staleness";
import {
  EXCEPTION_PROMPT_KEYS,
  FEEDBACK_SELF_CHECK_PROMPT_KEY,
} from "@/domain/training/requirements";
import { selectTemplateForDate } from "@/domain/templates/selection";
import { sessionRepository, templateRepository } from "@/lib/repositories/memory";
import {
  clearSessionDrafts,
  createDebouncedDraftSaver,
  getDraft,
} from "@/lib/persistence/drafts";
import { mockCoachProvider } from "@/lib/ai/providers/mock";

/**
 * §9-C(인증 정책)가 결정될 때까지 고정 Mock User로 진행한다(DEVELOPMENT_PLAN.md §15.1 A3).
 * 시간대도 §14-C 이전까지 고정값을 쓴다.
 */
export const MOCK_USER_ID = "mock-user-1";
export const MOCK_TIMEZONE = "Asia/Seoul";

function todayDateString(timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

interface State {
  status: "loading" | "ready" | "error";
  snapshot: TrainingSessionSnapshot | null;
  template: TrainingTemplate | null;
  errorMessage: string | null;
}

type Action =
  | { type: "loading" }
  | {
      type: "ready";
      snapshot: TrainingSessionSnapshot;
      template: TrainingTemplate | null;
    }
  | { type: "snapshotUpdated"; snapshot: TrainingSessionSnapshot }
  | { type: "error"; message: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "loading":
      return { status: "loading", snapshot: null, template: null, errorMessage: null };
    case "ready":
      return {
        status: "ready",
        snapshot: action.snapshot,
        template: action.template,
        errorMessage: null,
      };
    case "snapshotUpdated":
      return { ...state, snapshot: action.snapshot };
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
  completeSelfCheck: () => Promise<void>;
  requestHint: (hintLevel: HintLevel) => Promise<string>;
  requestFeedback: () => Promise<AIFeedback | null>;
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
  });

  const debouncedSaveRef = useRef(createDebouncedDraftSaver(500));

  /**
   * React state는 렌더에만 쓴다. 같은 이벤트 핸들러 안에서 "저장 → 바로 이어서 전환 검사"처럼
   * 연속으로 mutate를 호출하는 코드(예: submitObservation 후 advance)는 dispatch가 아직
   * 반영되지 않은 상태(state.snapshot)를 읽는 stale closure 문제를 만든다. 이 ref가 항상
   * "방금 저장한 최신값"을 동기적으로 들고 있어서 그 문제를 없앤다.
   */
  const snapshotRef = useRef<TrainingSessionSnapshot | null>(null);

  const commit = useCallback((snapshot: TrainingSessionSnapshot) => {
    snapshotRef.current = snapshot;
    dispatch({ type: "snapshotUpdated", snapshot });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      dispatch({ type: "loading" });
      try {
        const existing = await sessionRepository.getActiveSessionForUser(MOCK_USER_ID);
        let snapshot = existing;
        if (!snapshot) {
          const templates = await templateRepository.listActiveTemplates();
          const recentTemplateIds = await sessionRepository.listRecentTemplateIds(
            MOCK_USER_ID,
            5,
          );
          const chosen = selectTemplateForDate({
            date: todayDateString(MOCK_TIMEZONE),
            userId: MOCK_USER_ID,
            templates,
            recentTemplateIds,
          });
          snapshot = await sessionRepository.createSession({
            userId: MOCK_USER_ID,
            templateId: chosen.id,
            trainingDate: todayDateString(MOCK_TIMEZONE),
            timezone: MOCK_TIMEZONE,
            clientGeneratedId: crypto.randomUUID(),
          });
        }

        // /training 진입 자체가 "이어서 하기" 행동이다 — 보류 상태였다면 여기서 재개한다.
        if (snapshot.session.status === "paused") {
          const resumed = resumeSessionTransition(
            snapshot.session,
            snapshot.session.stateVersion,
          );
          if (resumed.ok) {
            snapshot = await sessionRepository.saveSnapshot({
              ...snapshot,
              session: resumed.session,
            });
          }
        }

        const templates = await templateRepository.listActiveTemplates();
        const template =
          templates.find((t) => t.id === snapshot.session.templateId) ?? null;
        if (!cancelled) {
          snapshotRef.current = snapshot;
          dispatch({ type: "ready", snapshot, template });
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

  /** 스냅샷을 순수 함수로 변형하고, 저장소에 반영한 뒤 상태를 갱신하는 공용 헬퍼. */
  const mutate = useCallback(
    async (
      fn: (current: TrainingSessionSnapshot) => TrainingSessionSnapshot,
    ): Promise<TrainingSessionSnapshot | null> => {
      const current = snapshotRef.current;
      if (!current) return null;
      const next = fn(current);
      const saved = await sessionRepository.saveSnapshot(next);
      commit(saved);
      return saved;
    },
    [commit],
  );

  const canAdvance = useMemo(
    () => (state.snapshot ? computeCanAdvance(state.snapshot) : false),
    [state.snapshot],
  );

  const advance = useCallback(async (): Promise<
    { ok: true } | { ok: false; message: string }
  > => {
    const current = snapshotRef.current;
    if (!current) return { ok: false, message: "세션이 아직 준비되지 않았습니다." };
    const result = advanceStage(current, current.session.stateVersion);
    if (!result.ok) return { ok: false, message: result.message };

    // 다음 단계로 넘어가기 전 확정된 초안은 더 이상 필요 없다 — 이 stage의 draft를 지운다.
    await clearSessionDrafts(current.session.id);
    const saved = await sessionRepository.saveSnapshot({
      ...current,
      session: result.session,
    });
    commit(saved);
    return { ok: true };
  }, [commit]);

  const pause = useCallback(async () => {
    const current = snapshotRef.current;
    if (!current) return;
    const result = pauseSessionTransition(current.session, current.session.stateVersion);
    if (!result.ok) return;
    const saved = await sessionRepository.saveSnapshot({
      ...current,
      session: result.session,
    });
    commit(saved);
  }, [commit]);

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

  /**
   * 이전 단계를 다시 수정했을 때 그 이후에 쌓인 AI 산출물을 stale로 표시한다
   * (domain/training/staleness.ts §7.4). 현재 편집 중인 stage보다 앞선 단계를 고친
   * 경우에만 의미가 있다 — 지금 단계 자체를 채우는 것은 staleness 대상이 아니다.
   */
  const propagateStalenessIfEditingPastStage = useCallback(
    (
      current: TrainingSessionSnapshot,
      editedStage: TrainingSessionSnapshot["session"]["currentStage"],
    ) => {
      if (editedStage === current.session.currentStage) return current;
      const computation = computeStaleArtifacts(editedStage, current);
      const patch = applyStaleness(current, computation);
      return { ...current, ...patch };
    },
    [],
  );

  const submitObservation = useCallback(
    async (input: ObservationDraft) => {
      await mutate((current) => {
        const observation = buildObservation(
          current.session.id,
          input,
          current.observation,
        );
        const withStale = propagateStalenessIfEditingPastStage(current, "observation");
        return { ...withStale, observation };
      });
    },
    [mutate, propagateStalenessIfEditingPastStage],
  );

  const addObservationItem = useCallback(
    async (input: ObservationItemDraft) => {
      await mutate((current) => {
        if (!current.observation) return current;
        const item = buildObservationItem(
          current.observation.id,
          input,
          current.observationItems.length,
        );
        return { ...current, observationItems: [...current.observationItems, item] };
      });
    },
    [mutate],
  );

  const confirmObservationItem = useCallback(
    async (itemId: string, confirmed: boolean) => {
      await mutate((current) => ({
        ...current,
        observationItems: current.observationItems.map((item) =>
          item.id === itemId ? { ...item, userConfirmed: confirmed } : item,
        ),
      }));
    },
    [mutate],
  );

  const addQuestion = useCallback(
    async (input: QuestionDraft, hintLevelUsed: HintLevel) => {
      await mutate((current) => {
        const question = {
          ...buildQuestion(current.session.id, input, current.questions.length),
          hintLevelUsed,
        };
        return { ...current, questions: [...current.questions, question] };
      });
    },
    [mutate],
  );

  const markPriorityQuestion = useCallback(
    async (questionId: string, reason: string) => {
      await mutate((current) => ({
        ...current,
        questions: current.questions.map((q) =>
          q.id === questionId
            ? { ...q, isPriority: true, priorityReason: reason }
            : { ...q, isPriority: false, priorityReason: undefined },
        ),
      }));
    },
    [mutate],
  );

  const addExplorationResponse = useCallback(
    async (promptKey: string, content: string) => {
      await mutate((current) => {
        const response = buildStageResponse(current.session.id, "exploration", {
          promptKey,
          content,
        });
        const withoutOld = current.stageResponses.filter(
          (r) => !(r.stage === "exploration" && r.promptKey === promptKey),
        );
        return { ...current, stageResponses: [...withoutOld, response] };
      });
    },
    [mutate],
  );

  const addPerspective = useCallback(
    async (input: PerspectiveDraft) => {
      await mutate((current) => {
        const perspective = buildPerspective(
          current.session.id,
          input,
          current.perspectives.length,
        );
        return { ...current, perspectives: [...current.perspectives, perspective] };
      });
    },
    [mutate],
  );

  const addReframe = useCallback(
    async (input: ReframeDraft, hintLevelUsed: HintLevel) => {
      await mutate((current) => {
        const reframe = buildReframe(current.session.id, input, current.reframes.length);
        void hintLevelUsed; // Reframe에는 hintLevel 필드가 없다 — Question과 달리 재정의는 힌트 사용을 별도로 추적하지 않는다.
        return { ...current, reframes: [...current.reframes, reframe] };
      });
    },
    [mutate],
  );

  const submitDefinition = useCallback(
    async (input: ProblemDefinitionDraft) => {
      await mutate((current) => {
        const version = buildProblemDefinitionVersion(
          current.session.id,
          input,
          current.problemDefinitionVersions,
        );
        const withStale = propagateStalenessIfEditingPastStage(current, "definition");
        return {
          ...withStale,
          problemDefinitionVersions: [...withStale.problemDefinitionVersions, version],
        };
      });
    },
    [mutate, propagateStalenessIfEditingPastStage],
  );

  const submitExceptionReason = useCallback(
    async (
      promptKey: (typeof EXCEPTION_PROMPT_KEYS)[keyof typeof EXCEPTION_PROMPT_KEYS],
      content: string,
    ) => {
      await mutate((current) => {
        const response = buildStageResponse(
          current.session.id,
          current.session.currentStage,
          {
            promptKey,
            content,
          },
        );
        return { ...current, stageResponses: [...current.stageResponses, response] };
      });
    },
    [mutate],
  );

  const completeSelfCheck = useCallback(async () => {
    await mutate((current) => {
      const response = buildStageResponse(current.session.id, "feedback", {
        promptKey: FEEDBACK_SELF_CHECK_PROMPT_KEY,
        content: "confirmed",
      });
      return { ...current, stageResponses: [...current.stageResponses, response] };
    });
  }, [mutate]);

  const requestHint = useCallback(
    async (hintLevel: HintLevel): Promise<string> => {
      const current = snapshotRef.current;
      if (!current) return "";
      const output = await mockCoachProvider.getCoachResponse({
        stage: current.session.currentStage,
        hintLevel,
        userText: current.observation?.rawText ?? "",
      });
      const interaction: CoachInteraction = {
        id: crypto.randomUUID(),
        sessionId: current.session.id,
        stage: current.session.currentStage,
        validatedOutput: output,
        action: output.action,
        hintLevel,
        provider: mockCoachProvider.provider,
        model: mockCoachProvider.model,
        promptVersion: mockCoachProvider.promptVersion,
        schemaVersion: mockCoachProvider.schemaVersion,
        latencyMs: 0,
        status: "ok",
        isStale: false,
        createdAt: new Date().toISOString(),
      };
      await mutate((snap) => ({
        ...snap,
        coachInteractions: [...snap.coachInteractions, interaction],
        session: { ...snap.session, aiCallCount: snap.session.aiCallCount + 1 },
      }));
      return output.question ?? "";
    },
    [mutate],
  );

  const requestFeedback = useCallback(async (): Promise<AIFeedback | null> => {
    const current = snapshotRef.current;
    if (!current) return null;
    const latest = current.problemDefinitionVersions.reduce<
      TrainingSessionSnapshot["problemDefinitionVersions"][number] | null
    >((max, v) => (!max || v.versionNumber > max.versionNumber ? v : max), null);
    if (!latest) return null;

    // 결정론적 Mock 피드백. 사용자가 실제로 쓴 문장을 그대로 인용해 근거를 만든다
    // (PRD §7.7 "사용자 문장에서 인용하거나 정확히 지칭할 수 있는 근거").
    const quote = latest.text.length > 60 ? `${latest.text.slice(0, 60)}…` : latest.text;
    const feedback: AIFeedback = {
      id: crypto.randomUUID(),
      sessionId: current.session.id,
      problemDefinitionVersionId: latest.id,
      dimensions: {},
      strength: `"${quote}"처럼 실제 문장에서 출발한 점이 좋아요.`,
      improvementFocus: "아직 확인하지 못한 사람들의 입장도 있는지 살펴보면 더 좋아요.",
      unverifiedAssumption:
        "지금 든 원인이 유일한 원인이라고 단정하지 않았는지 확인해보세요.",
      nextQuestion: "이 정의만 보고 다른 사람도 상황을 이해할 수 있을까요?",
      provider: mockCoachProvider.provider,
      model: mockCoachProvider.model,
      promptVersion: mockCoachProvider.promptVersion,
      schemaVersion: mockCoachProvider.schemaVersion,
      isStale: false,
      createdAt: new Date().toISOString(),
    };
    await mutate((snap) => ({
      ...snap,
      aiFeedbacks: [...snap.aiFeedbacks, feedback],
      session: { ...snap.session, aiCallCount: snap.session.aiCallCount + 1 },
    }));
    return feedback;
  }, [mutate]);

  const value: TrainingSessionContextValue = {
    status: state.status,
    snapshot: state.snapshot,
    template: state.template,
    errorMessage: state.errorMessage,
    canAdvance,
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

  return (
    <TrainingSessionContext.Provider value={value}>
      {children}
    </TrainingSessionContext.Provider>
  );
}
