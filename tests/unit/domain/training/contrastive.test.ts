import { describe, expect, it } from "vitest";
import { DAILY_TEMPLATES } from "@/data/templates";
import {
  CONTRASTIVE_EXAMPLES,
  contrastiveExampleFor,
} from "@/domain/training/contrastive";

describe("CONTRASTIVE_EXAMPLES", () => {
  /**
   * 렌즈 하나라도 사례가 없으면 그 렌즈가 오늘의 템플릿으로 뽑힌 날에만 통합 단계가
   * 조용히 사라진다 — 재현이 어렵고 눈에 띄지 않는 구멍이라 여기서 막는다.
   */
  it("실제로 쓰이는 모든 렌즈에 사례가 하나씩 있다", () => {
    const usedLenses = new Set(DAILY_TEMPLATES.filter((t) => t.active).map((t) => t.lensType));

    for (const lens of usedLenses) {
      expect(contrastiveExampleFor(lens), `${lens} 렌즈에 대조 사례가 없다`).not.toBeNull();
    }
  });

  it("렌즈당 사례가 정확히 하나다 — 어느 것을 보여줄지 모호해지면 안 된다", () => {
    const lenses = CONTRASTIVE_EXAMPLES.map((e) => e.lensType);
    expect(new Set(lenses).size).toBe(lenses.length);
  });

  it("세 문구가 모두 채워져 있다", () => {
    for (const example of CONTRASTIVE_EXAMPLES) {
      expect(example.weak.trim(), example.lensType).toBeTruthy();
      expect(example.strong.trim(), example.lensType).toBeTruthy();
      expect(example.whatChanged.trim(), example.lensType).toBeTruthy();
    }
  });

  /**
   * 대조의 요점은 "구체적으로 옮겨 적기"다. 강한 문장이 약한 문장보다 짧다면
   * 그 사례는 보여줄 것이 없다는 뜻이라 검수 대상이다.
   */
  it("옮겨 적은 문장이 처음 문장보다 구체적이다", () => {
    for (const example of CONTRASTIVE_EXAMPLES) {
      expect(example.strong.length, example.lensType).toBeGreaterThan(example.weak.length);
    }
  });
});

describe("contrastiveExampleFor", () => {
  it("렌즈를 모르면 null — 엉뚱한 사례를 억지로 보여주지 않는다", () => {
    expect(contrastiveExampleFor(null)).toBeNull();
    expect(contrastiveExampleFor(undefined)).toBeNull();
  });

  it("렌즈에 맞는 사례를 돌려준다", () => {
    expect(contrastiveExampleFor("repetition")?.lensType).toBe("repetition");
    expect(contrastiveExampleFor("info_timing")?.lensType).toBe("info_timing");
  });
});
