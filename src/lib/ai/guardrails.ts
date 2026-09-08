import type { Stage } from "@/domain/types";
import { nextStageOf } from "@/domain/training/stages";
import type { CoachOutputSchema } from "@/lib/schemas/coach-output";
import type { FeedbackOutputSchema } from "@/lib/schemas/feedback-output";

/**
 * AI 응답 검증 순서 2~8번 (DEVELOPMENT_PLAN.md §8.4). 1번(Zod Schema 검증)은 호출자가
 * `coachOutputSchema.safeParse`로 먼저 처리한다 — 이 파일은 "형태는 맞지만 내용이
 * 원칙을 어기는" 응답을 잡아낸다. 위반이 있으면 그 응답 전체를 버리고 규칙 기반
 * fallback으로 넘어간다(어떤 원문도 장기 저장하지 않는다 — §8.4 마지막 줄).
 */

export type GuardrailErrorCode =
  | "multiple_questions"
  | "missing_question"
  | "unverified_evidence"
  | "fabricated_fact"
  | "ghostwriting"
  | "solution_suggested"
  | "invalid_next_stage"
  | "repeated_question";

export interface GuardrailContext {
  currentStage: Exclude<Stage, "not_started">;
  userText: string;
  recentQuestions: string[];
}

export interface GuardrailResult {
  ok: boolean;
  /** 통과 시(또는 근거만 걸러내고 통과 가능할 때) 정리된 output. 실패 시 원본 그대로. */
  output: CoachOutputSchema;
  violations: GuardrailErrorCode[];
}

const QUESTION_MARK_PATTERN = /[?？]/;

/**
 * 2. 질문 개수 (원칙 2 — "AI는 한 번에 하나만 묻는다").
 *
 * 두 자리를 본다.
 * 1. `coachMessage`에 물음표가 있으면 질문이 둘이 된다(원래 있던 검사).
 * 2. **`question` 필드 안의 물음표 개수.** 이쪽은 검사하지 않고 있었다 — 모델이
 *    "언제였나요? 어디였나요? 누가 있었나요?"를 한 필드에 담아 보내면 그대로
 *    통과해서, 사용자는 한 번에 세 질문을 받는다. 이 앱이 하지 않겠다고 한 바로 그것이다.
 *
 * 물음표 없이 접속사로 이어붙인 경우("왜 그렇게 보셨고, 무엇이 근거였나요?")는
 * 어휘로 세기 어렵다. 그건 프롬프트가 맡는다.
 */
function checkSingleQuestion(output: CoachOutputSchema): boolean {
  if (output.question === null) return true;
  if (QUESTION_MARK_PATTERN.test(output.coachMessage)) return false;
  return (output.question.match(/[?？]/g) ?? []).length <= 1;
}

/**
 * 2-b. `action: "ask"`인데 질문이 없으면 위반.
 *
 * 실제 Upstage 응답에서 발견했다(2026-09-01 라이브 검증). 모델이 `action: "ask"`,
 * `question: null`, 그리고 내용 있는 `coachMessage`를 함께 반환했다. 기존 검사는
 * "질문이 null이면 통과"라서 이 자기모순을 그대로 통과시켰고, Route Handler는
 * `question`만 응답으로 돌려주므로 **AI 호출은 소진됐는데 화면에는 아무것도 뜨지 않았다.**
 *
 * 원칙 2("AI는 한 번에 하나만 묻는다")는 상한이자 하한이다 — 묻겠다고 해놓고 아무것도
 * 묻지 않으면 힌트 버튼이 침묵한다. 여기서 막으면 재시도 후 규칙 기반 fallback 질문이
 * 나가므로, 사용자는 어떤 경로로든 질문 하나를 받는다(원칙 8).
 *
 * 다른 action(`suggest_advance`·`feedback`·`fallback`·`safety`)은 질문이 없어도 정상이다.
 */
function checkAskHasQuestion(output: CoachOutputSchema): boolean {
  if (output.action !== "ask") return true;
  return Boolean(output.question?.trim());
}

/**
 * 3. 근거 존재 — evidenceReferences의 각 문자열이 사용자 입력에 부분 문자열로
 * 실제 존재하는지 확인한다. 존재하지 않는 항목은 제거하고, 원래 비어있지 않았는데
 * 전부 제거됐으면 위반으로 취급한다(§8.4 3번).
 */
function checkEvidence(
  output: CoachOutputSchema,
  userText: string,
): { evidenceReferences: string[]; violated: boolean } {
  if (output.evidenceReferences.length === 0) {
    return { evidenceReferences: [], violated: false };
  }
  const filtered = output.evidenceReferences.filter(
    (ref) => ref.trim().length > 0 && userText.includes(ref.trim()),
  );
  return { evidenceReferences: filtered, violated: filtered.length === 0 };
}

/**
 * 4. 사실 창작 검사 — 검사 가능한 범위로 한정한다(§8.4 4번 "검사 가능한 범위에서
 * 확인"). 고유명사 탐지는 일반적으로 신뢰할 수 없어 범위 밖이다 — 텍스트에 등장하는
 * 숫자가 사용자 입력에도 등장하는지만 확인한다. Coach·Feedback 양쪽에서 재사용한다.
 */
export function checkNoFabricatedNumbers(text: string, userText: string): boolean {
  const numbers = text.match(/\d+/g) ?? [];
  return numbers.every((n) => userText.includes(n));
}

/**
 * 5. 대필 검사 — 정의·돌아보기 단계에서 AI가 **문제 정의를 대신 써주면** 위반 (원칙 3).
 *
 * 원래는 패턴이 하나뿐이었다: `…에서 …는 … 때문에 …를 겪고 있다`. 실제로 나올 법한
 * 대필 문장 다섯 개로 재보니 **하나만 잡혔다.** "당신의 문제 정의는 …입니다" 같은
 * 노골적인 대필조차 통과했다 — 문장 틀이 조금만 달라도 빠져나간다.
 *
 * 그래서 **정의를 선언하는 표지**를 함께 본다. 코칭은 묻고, 대필은 단정한다.
 * 아래 패턴들은 전부 "그래서 문제는 이것이다"라고 못 박는 말투다.
 *
 * 한계도 적어둔다: 표지 없이 정의 문장만 툭 내놓는 경우("회의 시작 시각과 참석자 이동
 * 동선이 맞지 않아 반복 지각이 발생하고 있다.")는 **어휘로는 구분할 수 없다.** 같은
 * 모양의 문장이 "지금 정의에서 이런 점이 잘 드러납니다" 같은 정당한 논평일 수도 있기
 * 때문이다. 그 경계는 프롬프트와 근거 검사(3번)가 맡는다.
 */
const GHOSTWRITING_PATTERNS = [
  /에서\s*.+는\s*.+때문에\s*.+(겪|경험)/,
  /문제\s*정의는\s*[^?]*(입니다|이다|예요|이에요)/,
  /(이렇게|다음과\s*같이|이런\s*식으로)\s*정의(할\s*수\s*있|하면|됩니다|합니다)/,
  // `습니다`까지 받는다 — "…지연되고 있습니다"처럼 `입니다`가 아닌 종결이 흔하다.
  /(정리하면|요약하면|결론적으로)[,\s][^?]*(습니다|입니다|이다)/,
  /문제는\s*[^?]{5,}(입니다|이다)/,
  /로\s*정의(할\s*수\s*있|됩니다|합니다)/,
];

function checkNoGhostwriting(output: CoachOutputSchema, currentStage: Stage): boolean {
  if (currentStage !== "definition" && currentStage !== "feedback") return true;
  return !GHOSTWRITING_PATTERNS.some((pattern) => pattern.test(output.coachMessage));
}

/**
 * 6. 해결책 제안 검사 (원칙 3).
 *
 * 처음에는 `~해 보세요` 같은 권유형 어미를 통째로 위반으로 봤다. 그러다 실제 문구
 * "확인해보세요"가 걸려 피드백이 매번 실패하는 것을 발견하고 `확인`·`점검`·`검토`를
 * 부정 lookbehind로 예외 처리했다. 그 방식은 두 방향 모두 틀렸다:
 *
 * - **좋은 코칭을 거부한다.** "비교해 보세요"·"구분해 보세요"·"정리해 보세요"·
 *   "관찰해 보세요"·"질문해 보세요"·"설명해 보세요" — 이 앱의 코칭 어휘 대부분이
 *   `~해 보세요`로 끝난다. 예외가 셋뿐이니 나머지는 전부 해결책으로 오판됐고,
 *   그때마다 사용자는 맞춤 질문 대신 규칙 기반 fallback을 받았다.
 * - **진짜 해결책을 통과시킨다.** "담당자를 바꿔 보세요"는 `해`로 끝나지 않아
 *   패턴에 걸리지 않는다. 명백한 해결책 제안인데도 그대로 나갔다.
 *
 * 그래서 논리를 뒤집는다. **권유형 문장은 일단 전부 후보로 보고**, 그중 사고를
 * 겨누는 동사(아래 목록)로 된 권유만 걷어낸 뒤에도 권유가 남아 있으면 위반이다.
 * "무엇을 생각하라"는 코칭이고 "무엇을 하라"는 해결책이라는 구분을, 어휘 목록
 * 하나로 표현한 것이다.
 *
 * 한계는 분명하다 — 목록에 없는 사고 동사를 쓰면 오탐이 난다. 다만 이제 오탐은
 * **목록에 한 줄 추가**로 끝나고, 그 목록이 곧 이 앱이 권장하는 코칭 어휘다.
 */
const THINKING_VERB_STEMS = [
  "확인",
  "점검",
  "검토",
  "관찰",
  "질문",
  "구분",
  "비교",
  "정리",
  "생각",
  "상상",
  "가정",
  "기록",
  "분석",
  "설명",
  "표현",
  "구체화",
  "재정의",
  "서술",
  "묘사",
  "회상",
  "복기",
  "해석",
  "판단",
  "평가",
  "요약",
  "대조",
  "검증",
  "탐색",
  "상기",
  "구별",
  "정의",
];

/**
 * `~해 보다` 형태가 아닌 사고 동사들. "떠올려 볼까요"·"살펴 보세요"처럼 어간이
 * 이미 활용돼 있어 위 목록으로는 잡히지 않는다.
 */
const THINKING_VERB_FORMS = [
  "떠올려",
  "살펴",
  "되짚어",
  "헤아려",
  "짚어",
  "따져",
  "곱씹어",
  "나눠",
  "적어",
  "세어",
  "읽어",
  "써",
  "봐",
  "들여다",
  "되돌아",
  "뜯어",
  "알아",
  "찾아",
  "견줘",
  "견주어",
  "눈여겨",
  "따라가",
  "돌이켜",
  "떠올려",
  "물어",
];

/** 무엇을 하라고 권하는 어미. 이게 없으면 애초에 해결책 제안이 아니다. */
const SUGGESTION_ENDING =
  // `(?<!주)세요`로 명령형 전반을 잡되 `~주세요`는 뺀다. "적어주세요"·"남겨주세요"는
  // 사용자에게 **쓰라고 청하는** 말이라 코칭이고, "만드세요"·"바꾸세요"는 문제에
  // 손대라는 말이라 해결책이다. 그 둘을 가르는 가장 단순한 표지가 `주`다.
  /보세요|보시겠어요|볼까요|보시죠|(?<!주)세요|하십시오|하시길\s*추천|면\s*됩니다/;

/** 사고를 겨누는 권유. 이건 코칭이므로 위 후보에서 걷어낸다. */
const THINKING_SUGGESTION = new RegExp(
  // 템플릿 리터럴 안에서는 `\s`가 문자 `s`로 해석된다 — 정규식에 `\s`를 넘기려면
  // `\\s`로 써야 한다. 이걸 놓쳐서 한동안 아무것도 걷어내지 못하고 있었다.
  `(?:(?:${THINKING_VERB_STEMS.join("|")})\\s*(?:해|하여)?|(?:${THINKING_VERB_FORMS.join("|")}))` +
    `\\s*(?:보세요|보시겠어요|볼까요|보시죠|하세요|하십시오)`,
  "g",
);

export function checkNoSolution(text: string): boolean {
  if (!SUGGESTION_ENDING.test(text)) return true;
  // 사고를 겨누는 권유를 지우고도 권유가 남으면, 그건 "무엇을 하라"는 말이다.
  return !SUGGESTION_ENDING.test(text.replace(THINKING_SUGGESTION, ""));
}

/** 7. 단계 유효성 — suggestedNextStage는 STAGE_ORDER상 바로 다음 단계이거나 null. */
function checkValidNextStage(output: CoachOutputSchema, currentStage: Stage): boolean {
  if (output.suggestedNextStage === null) return true;
  return output.suggestedNextStage === nextStageOf(currentStage);
}

/** 8. 반복 질문 검사 — 최근 질문과 완전히 같은 문장이면 위반(단순 임계값). */
function checkNotRepeated(output: CoachOutputSchema, recentQuestions: string[]): boolean {
  if (output.question === null) return true;
  return !recentQuestions.some((q) => normalize(q) === normalize(output.question ?? ""));
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, "").toLowerCase();
}

export function runCoachGuardrails(
  output: CoachOutputSchema,
  context: GuardrailContext,
): GuardrailResult {
  const violations: GuardrailErrorCode[] = [];

  if (!checkSingleQuestion(output)) violations.push("multiple_questions");
  if (!checkAskHasQuestion(output)) violations.push("missing_question");

  const evidence = checkEvidence(output, context.userText);
  if (evidence.violated) violations.push("unverified_evidence");

  if (!checkNoFabricatedNumbers(output.coachMessage, context.userText)) {
    violations.push("fabricated_fact");
  }
  if (!checkNoGhostwriting(output, context.currentStage)) violations.push("ghostwriting");
  if (!checkNoSolution(output.coachMessage)) violations.push("solution_suggested");
  if (!checkValidNextStage(output, context.currentStage))
    violations.push("invalid_next_stage");
  if (!checkNotRepeated(output, context.recentQuestions))
    violations.push("repeated_question");

  if (violations.length > 0) {
    return { ok: false, output, violations };
  }

  return {
    ok: true,
    output: { ...output, evidenceReferences: evidence.evidenceReferences },
    violations: [],
  };
}

export type FeedbackGuardrailErrorCode = "fabricated_fact" | "solution_suggested";

export interface FeedbackGuardrailResult {
  ok: boolean;
  violations: FeedbackGuardrailErrorCode[];
}

/**
 * Feedback은 CoachOutput과 형태가 달라(질문·evidenceReferences·suggestedNextStage가
 * 없다) 전용 검사만 적용한다 — 해결책 제안 금지와 사실 창작 검사(검사 가능한
 * 범위)는 Coach와 동일한 원칙이라 함수를 재사용한다.
 */
export function runFeedbackGuardrails(
  output: FeedbackOutputSchema,
  userText: string,
): FeedbackGuardrailResult {
  const violations: FeedbackGuardrailErrorCode[] = [];
  const fields = [
    output.strength,
    output.improvementFocus,
    output.unverifiedAssumption,
    output.nextQuestion,
  ];

  if (fields.some((text) => !checkNoFabricatedNumbers(text, userText))) {
    violations.push("fabricated_fact");
  }
  if (fields.some((text) => !checkNoSolution(text))) {
    violations.push("solution_suggested");
  }

  return { ok: violations.length === 0, violations };
}
