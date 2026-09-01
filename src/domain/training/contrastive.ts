import type { TemplateLens } from "@/domain/types";

/**
 * 대조 사례 (RESEARCH_VALIDATION.md §5 P0-1). 렌즈마다 하나씩.
 *
 * 왜 필요한가 — 기존 7단계는 **전부 생성(generation)** 이었다. 사용자가 관찰하고
 * 질문하고 프레임을 만들고 정의를 쓰고 끝났다. Productive Failure 연구는 생성 단계
 * 뒤에 **전문가 해법과의 대조 분석(통합 단계)** 이 반드시 따라와야 효과가 난다고 본다.
 * 생성만 하고 통합이 없으면 Productive Failure가 아니라 Unproductive Failure다.
 * 초심자에게는 예시가 필요하다는 worked example 연구도 같은 지점을 가리킨다.
 *
 * ⚠️ **원칙을 어기지 않는 세 가지 장치가 여기 걸려 있다. 고칠 때 반드시 지킬 것.**
 * 1. **사용자 자신의 내용이 아니라 남의 사례다.** 사용자의 v1은 건드리지 않는다 —
 *    원칙 3(AI가 대신 정의하지 않는다)이 유지되는 이유가 이것이다.
 * 2. **AI가 생성하지 않는다.** 검수된 고정 콘텐츠(`system_template` 성격)라
 *    Guardrail·Evidence boundary와 아예 무관하다.
 * 3. **사용자가 v1을 저장한 뒤에만 보인다.** 먼저 보여주면 생성 효과와
 *    User-first gate가 무너진다.
 *
 * `data/templates.ts`가 아니라 여기 두는 이유: Daily Template은 DB에 시드되는
 * 영속 데이터지만, 대조 사례는 저장되지 않는 고정 문구다 — `STAGE_RATIONALE`·
 * `SELF_CHECK_ITEMS`와 같은 성격이라 같은 자리에 둔다. 그래야 `features/`가
 * `domain/`만 바라보는 기존 방향을 유지할 수 있다.
 *
 * ⚠️ 문구는 초안이다. `DAILY_TEMPLATES`와 마찬가지로 §14-F(Human Input) 검수 대상이다.
 * 검수 전까지 임시로 쓴다.
 */
export interface ContrastiveExample {
  lensType: TemplateLens;
  /** 처음 떠오르기 쉬운, 평가·단정이 섞인 문장. */
  weak: string;
  /** 같은 장면을 관찰 가능한 형태로 옮긴 문장. '정답'이 아니라 하나의 예다. */
  strong: string;
  /** 무엇이 달라졌는지 — 대조 분석의 핵심. 여기서 원리를 말한다. */
  whatChanged: string;
}

export const CONTRASTIVE_EXAMPLES: ContrastiveExample[] = [
  {
    lensType: "repetition",
    weak: "회의가 비효율적이다.",
    strong:
      "주간 회의에서 실무자 6명이 각자 진행 상황을 말하는 동안, 결정 권한이 있는 사람이 없어 논의가 다음 주로 미뤄진다.",
    whatChanged:
      "'비효율'이라는 평가가 눈으로 볼 수 있는 장면으로 바뀌었어요. 누가·어디서가 생겼고, 원인을 단정하는 대신 반복되는 지점만 적었어요.",
  },
  {
    lensType: "delay",
    weak: "내가 게을러서 서류를 안 낸다.",
    strong:
      "제출 서류를 쓰려고 앉을 때마다 어떤 항목이 필수인지 확인할 곳을 찾지 못해, 3주째 시작하지 못하고 있다.",
    whatChanged:
      "자기 비난이 사라지고 미뤄지는 지점이 드러났어요. '게으름'은 확인할 수 없지만 '확인할 곳을 못 찾는다'는 확인할 수 있어요.",
  },
  {
    lensType: "omission",
    weak: "신입이 일을 제대로 못 한다.",
    strong:
      "입사 2주 차 담당자가 반품을 처리할 때 어느 단계에서 승인을 받아야 하는지 문서에 없어, 매번 선임에게 묻고 기다린다.",
    whatChanged:
      "사람에 대한 평가가 빠진 정보에 대한 관찰로 바뀌었어요. 누가 무엇을 기다리는지가 드러났어요.",
  },
  {
    lensType: "goal_mismatch",
    weak: "다들 회의만 많이 한다.",
    strong:
      "고객 응대 시간을 줄이자는 목표를 세웠는데, 실제로 늘어난 것은 상황 공유 회의였고 응대 절차 자체는 그대로다.",
    whatChanged:
      "불만이 목표와 실제 행동 사이의 어긋남으로 바뀌었어요. 무엇을 원했는지가 문장 안에 들어왔어요.",
  },
  {
    lensType: "unfair_process",
    weak: "휴가 승인이 불공평하다.",
    strong:
      "휴가 신청이 팀장 재량으로만 결정되고 기준이 공유되지 않아, 같은 시기에 신청한 두 사람의 결과가 달랐던 적이 있다.",
    whatChanged:
      "'불공평'이라는 판단의 근거가 드러났어요. 무엇이 공유되지 않았는지가 확인할 수 있는 형태가 됐어요.",
  },
  {
    lensType: "counter_example",
    weak: "우리 팀은 소통이 안 된다.",
    strong:
      "긴급 장애 대응 때는 정보가 빠르게 공유되는데, 일정 변경은 담당자 한 명에게만 전달돼 나머지가 뒤늦게 안다.",
    whatChanged:
      "'소통이 안 된다'가 되는 때와 안 되는 때의 차이로 바뀌었어요. 반대 사례를 찾으면 문제의 범위가 좁아져요.",
  },
  {
    lensType: "unfounded_rule",
    weak: "쓸데없는 규칙이 많다.",
    strong:
      "출장 보고서를 종이로도 제출하게 돼 있는데, 언제 왜 생긴 규칙인지 아는 사람을 아직 찾지 못했다.",
    whatChanged:
      "'쓸데없다'는 판단 대신 아직 확인하지 못했다는 사실이 남았어요. 확인하지 못한 것을 그대로 적는 것도 정직한 정의예요.",
  },
  {
    lensType: "info_timing",
    weak: "정보 공유가 늦다.",
    strong:
      "발주 수량 변경이 생산 일정 확정 이후에 전달돼, 이미 준비한 자재를 다시 계산해야 했던 일이 이번 달에 두 번 있었다.",
    whatChanged:
      "'늦다'가 무엇 이후에 오는지로 바뀌었어요. 언제 오면 늦지 않은지도 함께 드러났어요.",
  },
];

/**
 * 그 세션의 렌즈에 맞는 대조 사례를 고른다. 렌즈를 모르면(템플릿 로딩 실패 등)
 * null을 반환한다 — 엉뚱한 렌즈의 사례를 억지로 보여주느니 아무것도 안 보이는 편이
 * 낫다. 통합 단계가 빠져도 세션은 그대로 완주된다(원칙 8과 같은 태도).
 */
export function contrastiveExampleFor(
  lensType: TemplateLens | null | undefined,
): ContrastiveExample | null {
  if (!lensType) return null;
  return CONTRASTIVE_EXAMPLES.find((example) => example.lensType === lensType) ?? null;
}
