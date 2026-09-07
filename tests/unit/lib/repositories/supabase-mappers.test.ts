import { describe, expect, it } from "vitest";
import {
  aiFeedbackDomainToRow,
  aiFeedbackRowToDomain,
  coachInteractionDomainToRow,
  coachInteractionRowToDomain,
  observationDomainToRow,
  observationItemDomainToRow,
  observationItemRowToDomain,
  observationRowToDomain,
  perspectiveDomainToRow,
  perspectiveRowToDomain,
  problemDefinitionVersionDomainToRow,
  problemDefinitionVersionRowToDomain,
  questionDomainToRow,
  questionRowToDomain,
  reframeDomainToRow,
  reframeRowToDomain,
  sessionDomainToRow,
  sessionRowToDomain,
  templateRowToDomain,
  stageResponseDomainToRow,
  stageResponseRowToDomain,
} from "@/lib/repositories/supabase/mappers";
import type {
  AIFeedback,
  CoachInteraction,
  Observation,
  ObservationItem,
  Perspective,
  ProblemDefinitionVersion,
  Question,
  Reframe,
  StageResponse,
  TrainingSession,
} from "@/domain/types";

/**
 * 도메인 ↔ DB 행 매퍼의 왕복 검사.
 *
 * 이 파일은 326줄 전부가 `snake_case ↔ camelCase` 손 매핑인데 단위 테스트가 하나도
 * 없었다. E2E는 이 경로를 매일 지나가지만 **같은 타입의 필드가 서로 뒤바뀐 경우를
 * 잡지 못한다** — `started_at`과 `last_active_at`을 맞바꿔도 화면은 멀쩡히 그려진다.
 * 이 프로젝트는 이미 그 종류의 결함을 겪었다(자기 점검 키와 AI 차원 키의 이름 체계가
 * 갈라져 대조 기능이 조용히 죽었던 건).
 *
 * 그래서 값을 **필드마다 다르게** 넣는다. 모든 문자열이 서로 달라야 뒤바뀜이 드러난다.
 * 왕복이 원본과 같으면 이름·개수·null 처리가 전부 맞다는 뜻이다.
 */

const SESSION: TrainingSession = {
  id: "session-id",
  clientGeneratedId: "client-generated-id",
  userId: "user-id",
  templateId: "template-id",
  trainingDate: "2026-09-08",
  timezone: "Asia/Seoul",
  status: "reframing",
  currentStage: "reframing",
  lastActiveStage: "exploration",
  stateVersion: 4,
  aiCallCount: 7,
  originSessionId: "origin-session-id",
  startedAt: "2026-09-08T01:00:00.000Z",
  lastActiveAt: "2026-09-08T02:00:00.000Z",
  completedAt: "2026-09-08T03:00:00.000Z",
  abandonedAt: "2026-09-08T04:00:00.000Z",
  createdAt: "2026-09-08T05:00:00.000Z",
  updatedAt: "2026-09-08T06:00:00.000Z",
};

const OBSERVATION: Observation = {
  id: "observation-id",
  sessionId: "observation-session-id",
  rawText: "관찰 원문",
  contextWhen: "월요일 아침",
  contextWhere: "회의실",
  version: 2,
  createdAt: "2026-09-08T01:00:00.000Z",
  updatedAt: "2026-09-08T02:00:00.000Z",
};

const OBSERVATION_ITEM: ObservationItem = {
  id: "item-id",
  observationId: "item-observation-id",
  text: "확인한 사실",
  type: "fact",
  authorType: "user",
  userConfirmed: true,
  order: 3,
};

const STAGE_RESPONSE: StageResponse = {
  id: "response-id",
  sessionId: "response-session-id",
  stage: "exploration",
  promptKey: "affected_user",
  content: "영향을 받는 사람",
  authorType: "user",
  hintLevelUsed: 2,
  isDraft: false,
  isStale: true,
  version: 5,
  createdAt: "2026-09-08T01:00:00.000Z",
  updatedAt: "2026-09-08T02:00:00.000Z",
};

const QUESTION: Question = {
  id: "question-id",
  sessionId: "question-session-id",
  text: "왜 이럴까?",
  authorType: "user",
  lensType: "cause_hypothesis",
  order: 1,
  isPriority: true,
  priorityReason: "가장 반복되기 때문",
  hintLevelUsed: 1,
  // Question에는 시각 필드가 없다 — `questions` 테이블에 컬럼 자체가 없고,
  // 순서는 `question_order`가 들고 있어서 시각이 필요 없다. 매퍼 양쪽 다 비운다.
};

const PERSPECTIVE: Perspective = {
  id: "perspective-id",
  sessionId: "perspective-session-id",
  lensType: "stakeholder",
  content: "다른 관점에서 본 내용",
  authorType: "user",
  order: 2,
  createdAt: "2026-09-08T01:00:00.000Z",
  updatedAt: "2026-09-08T02:00:00.000Z",
};

const REFRAME: Reframe = {
  id: "reframe-id",
  sessionId: "reframe-session-id",
  text: "대안 프레임",
  authorType: "user",
  order: 4,
};

const DEFINITION: ProblemDefinitionVersion = {
  id: "definition-id",
  sessionId: "definition-session-id",
  versionNumber: 2,
  text: "고쳐 쓴 정의",
  authorType: "user",
  createdAt: "2026-09-08T01:00:00.000Z",
};

const FEEDBACK: AIFeedback = {
  id: "feedback-id",
  sessionId: "feedback-session-id",
  problemDefinitionVersionId: "feedback-definition-id",
  dimensions: {
    evidence: { status: "shown", evidence: "근거 문장" },
    userAndContext: { status: "explore_further", evidence: "" },
    goalBarrierImpact: { status: "unverified", evidence: "" },
    factVsHypothesis: { status: "shown", evidence: "" },
    perspectiveAndScope: { status: "shown", evidence: "" },
    furtherInquiry: { status: "explore_further", evidence: "" },
  },
  strength: "강점 문장",
  improvementFocus: "보완할 지점",
  unverifiedAssumption: "확인되지 않은 가정",
  nextQuestion: "다음 질문",
  provider: "upstage",
  model: "solar-pro4",
  promptVersion: "prompt-v1",
  schemaVersion: "schema-v1",
  isStale: true,
  createdAt: "2026-09-08T01:00:00.000Z",
};

const INTERACTION: CoachInteraction = {
  id: "interaction-id",
  sessionId: "interaction-session-id",
  stage: "questioning",
  validatedOutput: { any: "shape" },
  action: "ask",
  hintLevel: 2,
  provider: "upstage",
  model: "solar-pro4",
  promptVersion: "prompt-v2",
  schemaVersion: "schema-v2",
  latencyMs: 1234,
  status: "ok",
  errorCode: "guardrail:solution_suggested",
  isStale: false,
  createdAt: "2026-09-08T01:00:00.000Z",
};

describe("supabase mappers — 도메인 ↔ 행 왕복", () => {
  it.each([
    [
      "session",
      SESSION,
      (v: TrainingSession) => sessionRowToDomain(sessionDomainToRow(v) as never),
    ],
    [
      "observation",
      OBSERVATION,
      (v: Observation) => observationRowToDomain(observationDomainToRow(v) as never),
    ],
    [
      "observationItem",
      OBSERVATION_ITEM,
      (v: ObservationItem) =>
        observationItemRowToDomain(observationItemDomainToRow(v) as never),
    ],
    [
      "stageResponse",
      STAGE_RESPONSE,
      (v: StageResponse) =>
        stageResponseRowToDomain(stageResponseDomainToRow(v) as never),
    ],
    [
      "question",
      QUESTION,
      (v: Question) => questionRowToDomain(questionDomainToRow(v) as never),
    ],
    [
      "perspective",
      PERSPECTIVE,
      (v: Perspective) => perspectiveRowToDomain(perspectiveDomainToRow(v) as never),
    ],
    [
      "reframe",
      REFRAME,
      (v: Reframe) => reframeRowToDomain(reframeDomainToRow(v) as never),
    ],
    [
      "problemDefinitionVersion",
      DEFINITION,
      (v: ProblemDefinitionVersion) =>
        problemDefinitionVersionRowToDomain(
          problemDefinitionVersionDomainToRow(v) as never,
        ),
    ],
    [
      "aiFeedback",
      FEEDBACK,
      (v: AIFeedback) => aiFeedbackRowToDomain(aiFeedbackDomainToRow(v) as never),
    ],
    [
      "coachInteraction",
      INTERACTION,
      (v: CoachInteraction) =>
        coachInteractionRowToDomain(coachInteractionDomainToRow(v) as never),
    ],
  ])("%s는 왕복해도 그대로다", (_name, value, roundTrip) => {
    // 필드마다 값이 다르므로, 같은 타입의 두 필드가 뒤바뀌면 여기서 드러난다.
    expect(roundTrip(value as never)).toEqual(value);
  });

  it("선택 필드가 비어 있어도 왕복이 깨지지 않는다", () => {
    // DB는 null, 도메인은 undefined를 쓴다. 이 경계가 어긋나면 "값이 있는데 없다고
    // 읽히는" 종류의 결함이 되고, 화면에서는 그냥 빈칸으로 보여 알아채기 어렵다.
    const minimal: TrainingSession = {
      ...SESSION,
      lastActiveStage: null,
      originSessionId: undefined,
      completedAt: undefined,
      abandonedAt: undefined,
    };
    expect(sessionRowToDomain(sessionDomainToRow(minimal) as never)).toEqual(minimal);

    const bareObservation: Observation = {
      ...OBSERVATION,
      contextWhen: undefined,
      contextWhere: undefined,
    };
    expect(
      observationRowToDomain(observationDomainToRow(bareObservation) as never),
    ).toEqual(bareObservation);

    const bareQuestion: Question = {
      ...QUESTION,
      lensType: undefined,
      priorityReason: undefined,
    };
    expect(questionRowToDomain(questionDomainToRow(bareQuestion) as never)).toEqual(
      bareQuestion,
    );
  });

  it("템플릿 행은 도메인 필드에 하나씩 대응한다", () => {
    // 템플릿은 읽기 전용 시드라 반대 방향 매퍼가 없다 — 왕복 대신 직접 확인한다.
    // 값을 서로 다르게 두어 title과 prompt가 뒤바뀌는 종류를 잡는다.
    expect(
      templateRowToDomain({
        id: "template-id",
        title: "제목",
        prompt: "질문 문장",
        lens_type: "repetition",
        difficulty: 2,
        version: 3,
        active: true,
      } as never),
    ).toEqual({
      id: "template-id",
      title: "제목",
      prompt: "질문 문장",
      lensType: "repetition",
      difficulty: 2,
      version: 3,
      active: true,
    });
  });

  it("세션의 시각 필드 네 개가 서로 뒤바뀌지 않는다", () => {
    // 전부 같은 타입(ISO 문자열)이라 뒤바뀌어도 타입 검사는 통과한다. 값이 서로
    // 다르다는 것에 기대어 이름이 제자리에 붙어 있는지 확인한다.
    const row = sessionDomainToRow(SESSION);
    expect(row.started_at).toBe(SESSION.startedAt);
    expect(row.last_active_at).toBe(SESSION.lastActiveAt);
    expect(row.created_at).toBe(SESSION.createdAt);
    expect(row.updated_at).toBe(SESSION.updatedAt);
  });
});
