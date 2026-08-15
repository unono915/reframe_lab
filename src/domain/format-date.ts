/**
 * 화면에 날짜를 보여줄 때 쓰는 표기 규칙. 순수 함수라 domain에 둔다.
 *
 * 저장 형식은 `YYYY-MM-DD`(DB `training_date`)지만 그대로 노출하면 "2026-08-16",
 * "2026년 08월"처럼 기계가 읽는 문자열이 그대로 보인다. 하루 5~10분 쓰는 개인 기록
 * 앱이라 날짜는 자주 눈에 띄는 요소다.
 */

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function parts(dateString: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** "2026-08-16" → "8월 16일 (일)". 파싱에 실패하면 원문을 그대로 돌려준다. */
export function formatRecordDate(dateString: string): string {
  const p = parts(dateString);
  if (!p) return dateString;
  const weekday = WEEKDAYS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
  return `${p.m}월 ${p.d}일 (${weekday})`;
}

/** "2026-08" → "2026년 8월". History의 월 Grouping 헤더용. */
export function formatMonthLabel(monthString: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthString);
  if (!match) return monthString;
  return `${match[1]}년 ${Number(match[2])}월`;
}
