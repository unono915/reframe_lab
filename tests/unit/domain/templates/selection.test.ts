import { describe, expect, it } from "vitest";
import {
  resolveTimeZone,
  selectTemplateForDate,
  todayDateString,
} from "@/domain/templates/selection";
import { DAILY_TEMPLATES } from "@/data/templates";
import type { TrainingTemplate } from "@/domain/types";

function template(overrides: Partial<TrainingTemplate>): TrainingTemplate {
  return {
    id: "t-1",
    title: "제목",
    prompt: "프롬프트",
    lensType: "repetition",
    difficulty: 1,
    version: 1,
    active: true,
    ...overrides,
  };
}

describe("selectTemplateForDate — determinism", () => {
  it("returns the exact same template for the same (userId, date) pair", () => {
    const first = selectTemplateForDate({
      date: "2026-08-15",
      userId: "user-a",
      templates: DAILY_TEMPLATES,
    });
    const second = selectTemplateForDate({
      date: "2026-08-15",
      userId: "user-a",
      templates: DAILY_TEMPLATES,
    });
    expect(second.id).toBe(first.id);
  });

  it("is stable across many repeated calls, not just twice", () => {
    const results = new Set(
      Array.from(
        { length: 20 },
        () =>
          selectTemplateForDate({
            date: "2026-01-01",
            userId: "stable-user",
            templates: DAILY_TEMPLATES,
          }).id,
      ),
    );
    expect(results.size).toBe(1);
  });

  it("is unaffected by the input array's order", () => {
    const shuffled = [...DAILY_TEMPLATES].reverse();
    const a = selectTemplateForDate({
      date: "2026-08-15",
      userId: "user-a",
      templates: DAILY_TEMPLATES,
    });
    const b = selectTemplateForDate({
      date: "2026-08-15",
      userId: "user-a",
      templates: shuffled,
    });
    expect(b.id).toBe(a.id);
  });

  it("differs across different users on the same date (not just a date-only hash)", () => {
    const a = selectTemplateForDate({
      date: "2026-08-15",
      userId: "user-a",
      templates: DAILY_TEMPLATES,
    });
    const b = selectTemplateForDate({
      date: "2026-08-15",
      userId: "user-b",
      templates: DAILY_TEMPLATES,
    });
    // 완전히 다른 유저 100명 중 전부 같은 템플릿이 나오는 건 사실상 불가능하니,
    // 결정성 자체보다 "userId도 실제로 시드에 반영된다"를 넓게 확인한다.
    const ids = new Set(
      Array.from(
        { length: 30 },
        (_, i) =>
          selectTemplateForDate({
            date: "2026-08-15",
            userId: `user-${i}`,
            templates: DAILY_TEMPLATES,
          }).id,
      ),
    );
    expect(ids.size).toBeGreaterThan(1);
    expect(a.id === b.id || ids.size > 1).toBe(true);
  });

  it("differs across different dates for the same user in general", () => {
    const ids = new Set(
      Array.from({ length: 30 }, (_, i) => {
        const day = String(i + 1).padStart(2, "0");
        return selectTemplateForDate({
          date: `2026-01-${day}`,
          userId: "user-a",
          templates: DAILY_TEMPLATES,
        }).id;
      }),
    );
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe("selectTemplateForDate — lens avoidance (PRD §6.6)", () => {
  it("never returns a lens seen in the recent window when alternatives exist", () => {
    const templates = [
      template({ id: "a", lensType: "repetition" }),
      template({ id: "b", lensType: "delay" }),
      template({ id: "c", lensType: "omission" }),
    ];
    for (let i = 0; i < 20; i += 1) {
      const result = selectTemplateForDate({
        date: `2026-02-${String(i + 1).padStart(2, "0")}`,
        userId: "user-a",
        templates,
        recentTemplateIds: ["a"],
        avoidRecentLensCount: 1,
      });
      expect(result.lensType).not.toBe("repetition");
    }
  });

  it("falls back to the full active list when avoidance would leave zero candidates", () => {
    const templates = [template({ id: "only", lensType: "repetition" })];
    const result = selectTemplateForDate({
      date: "2026-08-15",
      userId: "user-a",
      templates,
      recentTemplateIds: ["only"],
      avoidRecentLensCount: 1,
    });
    expect(result.id).toBe("only");
  });

  it("only considers the configured recency window, not the entire history", () => {
    const templates = [
      template({ id: "a", lensType: "repetition" }),
      template({ id: "b", lensType: "delay" }),
    ];
    // avoidRecentLensCount: 1 → 배열의 첫 항목("a")만 회피 대상, "b"는 회피하지 않는다.
    const result = selectTemplateForDate({
      date: "2026-08-15",
      userId: "user-a",
      templates,
      recentTemplateIds: ["a", "b"],
      avoidRecentLensCount: 1,
    });
    expect(result.lensType).not.toBe("repetition");
  });
});

describe("selectTemplateForDate — active filter", () => {
  it("never returns an inactive template", () => {
    const templates = [
      template({ id: "inactive", active: false }),
      template({ id: "active", lensType: "delay" }),
    ];
    for (let i = 0; i < 10; i += 1) {
      const result = selectTemplateForDate({
        date: `2026-03-${String(i + 1).padStart(2, "0")}`,
        userId: `u-${i}`,
        templates,
      });
      expect(result.id).toBe("active");
    }
  });

  it("throws a clear error when there are no active templates at all", () => {
    expect(() =>
      selectTemplateForDate({
        date: "2026-08-15",
        userId: "user-a",
        templates: [template({ active: false })],
      }),
    ).toThrow();
  });
});

describe("DAILY_TEMPLATES fixture data", () => {
  it("has exactly 24 templates (8 lenses × 3)", () => {
    expect(DAILY_TEMPLATES).toHaveLength(24);
  });

  it("has unique ids", () => {
    const ids = new Set(DAILY_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(DAILY_TEMPLATES.length);
  });

  it("covers all 8 template lenses with exactly 3 each", () => {
    const counts = new Map<string, number>();
    for (const t of DAILY_TEMPLATES) {
      counts.set(t.lensType, (counts.get(t.lensType) ?? 0) + 1);
    }
    expect(counts.size).toBe(8);
    for (const count of counts.values()) {
      expect(count).toBe(3);
    }
  });

  it("is all active by default", () => {
    expect(DAILY_TEMPLATES.every((t) => t.active)).toBe(true);
  });
});

/**
 * 시간대 값은 브라우저가 보고한 것을 그대로 서버까지 들고 온 것이라, `Intl`이 모르는
 * 값이 오는 경로가 실제로 있다 — 지문 방지 설정이 켜진 브라우저, 오래된 런타임,
 * 그리고 주소창에서 쿼리를 고친 사람. 던지게 두면 홈·성장·오늘의 렌즈가 한꺼번에
 * 500으로 죽고, 화면에는 원인을 알 수 없는 "잠시 문제가 생겼어요"만 남는다.
 */
describe("시간대 값이 이상해도 앱은 계속 쓸 수 있어야 한다", () => {
  it("모르는 시간대를 받아도 날짜를 돌려준다", () => {
    expect(todayDateString("Not/AZone")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(todayDateString("")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("제대로 된 시간대는 그대로 쓴다", () => {
    // 서울과 UTC는 9시간 차이라, UTC 기준으로 아직 어제인 시각이 존재한다.
    // 두 값이 항상 같지는 않지만 형식은 언제나 YYYY-MM-DD여야 한다.
    expect(todayDateString("Asia/Seoul")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("저장하기 전에 못 쓰는 값은 UTC로 바꾼다", () => {
    // DB에 못 쓰는 값이 들어가면, 그 세션을 읽는 모든 경로가 나중에 같은 자리에서 걸린다.
    expect(resolveTimeZone("Asia/Seoul")).toBe("Asia/Seoul");
    expect(resolveTimeZone("Not/AZone")).toBe("UTC");
    expect(resolveTimeZone("")).toBe("UTC");
    expect(resolveTimeZone(null)).toBe("UTC");
    expect(resolveTimeZone(undefined)).toBe("UTC");
  });
});
