import { describe, expect, it } from "vitest";
import { formatMonthLabel, formatRecordDate } from "@/domain/format-date";

/**
 * 저장 형식(YYYY-MM-DD)을 그대로 노출하면 "2026-08-16", "2026년 08월"처럼 기계가
 * 읽는 문자열이 화면에 보인다. 매일 여는 앱이라 날짜는 자주 눈에 띄는 요소다.
 */
describe("formatRecordDate", () => {
  it("연도를 빼고 월·일과 요일을 보여준다", () => {
    expect(formatRecordDate("2026-08-16")).toBe("8월 16일 (일)");
  });

  it("한 자리 월·일에 0을 붙이지 않는다", () => {
    expect(formatRecordDate("2026-01-05")).toBe("1월 5일 (월)");
  });

  it("요일 계산은 UTC 기준으로 고정한다 — 실행 환경 시간대에 흔들리지 않아야 한다", () => {
    // 2026-03-01은 일요일.
    expect(formatRecordDate("2026-03-01")).toContain("(일)");
    // 윤년이 아닌 해의 2월 마지막 날.
    expect(formatRecordDate("2026-02-28")).toBe("2월 28일 (토)");
  });

  it("형식이 다르면 원문을 그대로 돌려준다 — 화면에 빈칸이나 Invalid Date를 띄우지 않는다", () => {
    expect(formatRecordDate("2026/08/16")).toBe("2026/08/16");
    expect(formatRecordDate("")).toBe("");
    expect(formatRecordDate("어제")).toBe("어제");
  });
});

describe("formatMonthLabel", () => {
  it("월의 앞자리 0을 없앤다", () => {
    expect(formatMonthLabel("2026-08")).toBe("2026년 8월");
    expect(formatMonthLabel("2026-12")).toBe("2026년 12월");
  });

  it("형식이 다르면 원문을 그대로 돌려준다", () => {
    expect(formatMonthLabel("2026")).toBe("2026");
  });
});
