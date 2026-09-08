import { expect, test } from "@playwright/test";
import { resetActiveSession } from "./helpers/cleanup";
import {
  completeSelfAssessment,
  DEFAULT_CONTENT,
  fillStagesUntilFeedback,
  finishSession,
  SELF_CHECK_LABELS,
  settle,
} from "./helpers/training-flow";

/**
 * DEVELOPMENT_PLAN.md §10 Phase 2 완료 조건: "7단계를 처음부터 끝까지 진행해 완료
 * 상태에 도달 가능". Home → 7단계 → Result까지 실제 폼 입력으로 완주한다.
 *
 * 돌아보기 단계의 순서는 P0-2·P0-4로 바뀌었다: 생성(v1) → 통합(대조) → **자기평가**
 * → 외부 피드백 → 수정(v2). AI 피드백은 자기평가를 저장한 뒤에만 열린다.
 *
 * Phase 3부터 로그인이 필수라 전용 E2E 계정(E2E_TEST_EMAIL/PASSWORD, global-setup.ts)이
 * 필요하다 — 없으면 이 파일 전체를 건너뛴다.
 */
test.skip(
  !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
  "E2E_TEST_EMAIL/PASSWORD 미설정 — 로그인 필요한 E2E는 건너뜀 (.env.example 참고)",
);

test.beforeEach(async ({ request }) => {
  await resetActiveSession(request);
});

test("완주: Home에서 시작해 7단계를 모두 거쳐 Result에 도달한다", async ({ page }) => {
  // 6단계 입력(~15초)에 실제 제공자 호출이 더해진다. 제공자 타임아웃이 20초라
  // 기본 30초로는 정상 동작에서도 실패한다 — 실제로 그렇게 깨져 있었다.
  test.setTimeout(90_000);

  await page.goto("/");
  await expect(page.getByText("오늘 다시 볼 장면")).toBeVisible();
  await page.getByRole("link", { name: /오늘의 훈련 시작|이어서 하기/ }).click();

  await fillStagesUntilFeedback(page);

  // 자기평가를 먼저 마쳐야 코치 피드백이 열린다.
  await completeSelfAssessment(page);
  await page.getByRole("button", { name: "AI 피드백 보기" }).click();
  // 실제 제공자를 부르는 자리다. **응답 내용을 단언하지 않는다** — 같은 입력에도
  // 모델 출력이 달라 Guardrail을 통과하는 날과 아닌 날이 있고, 그때는 규칙 기반
  // fallback으로 넘어간다. 그건 결함이 아니라 원칙 8이 설계대로 동작한 것이다.
  // 여기서 잠글 것은 "무엇이 오든 화면이 침묵하지 않는다"이고, 그게 이 프로젝트에서
  // 네 번 재발한 증상이기도 하다. AI가 죽었을 때의 동작 자체는
  // `ai-failure-fallback.spec.ts`가 제공자를 실제로 죽여놓고 따로 검증한다.
  await expect(
    page
      .getByText("이미 드러난 점")
      .or(page.getByText("지금은 AI 피드백을 만들 수 없어요", { exact: false })),
  ).toBeVisible({ timeout: 45_000 });

  await finishSession(page);
  // AI 피드백이 정의 문장을 인용할 수 있으므로, 정의 자체는 정확히 일치하는 문단으로 좁혀 확인한다.
  await expect(page.getByText(DEFAULT_CONTENT.definition, { exact: true })).toBeVisible();
});

test("완주(자기 점검 경로): AI 피드백 없이 자기 점검만으로도 완료할 수 있다", async ({
  page,
}) => {
  await page.goto("/training/new");

  await fillStagesUntilFeedback(page, {
    ...DEFAULT_CONTENT,
    observation: "팀 채팅에 아무도 답을 안 한다",
    observationItem: "어제 올린 질문에 아직 답이 없다",
    questions: ["다들 못 본 걸까?", "질문이 불명확했을까?", "다른 채널이 나을까?"],
    priorityReason: "가장 빨리 확인 가능함",
    exploration: {
      affected: "질문을 올린 나",
      context: "바쁜 주간의 팀 채팅",
      impact: "결정이 미뤄지고 있다",
      unknown: "모르겠다",
    },
    reframes: [
      "질문이 너무 길어서 다들 미룬 것일 수 있다",
      "채팅보다 회의에서 다룰 주제였을 수 있다",
    ],
    definition: "질문 형식과 채널이 맞지 않아 팀 채팅 응답이 늦어지고 있다",
  });
  await settle(page);

  // AI 피드백을 요청하지 않고 자기 점검만으로 완료 (PRD §7.12 Fallback path)
  await completeSelfAssessment(page);
  await finishSession(page);

  /*
    그때 스스로 어떻게 판단했는지도 기록의 일부다. 저장은 P0-2부터 되고 있었는데
    기록 화면에만 빠져 있어서, 다시 볼 때 남는 것은 결과물뿐이었다 — 2주 뒤에 다시
    여는 자리(P1-8)에서 "그때의 판단"이 없으면 무엇을 놓쳤는지 견줄 것이 없다.
  */
  await expect(page.getByText("그때의 자기 점검")).toBeVisible();
  await expect(page.getByText(SELF_CHECK_LABELS[0])).toBeVisible();
});
