import type { TrainingTemplate } from "@/domain/types";

/** FNV-1a 32bit — 암호학적 용도가 아니라 결정론적 분산에만 쓴다. */
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface SelectTemplateParams {
  /** 사용자 시간대 기준 훈련 날짜, YYYY-MM-DD. */
  date: string;
  userId: string;
  templates: TrainingTemplate[];
  /** 최근 노출된 템플릿 id, 최신순. */
  recentTemplateIds?: string[];
  /** 최근 몇 개 노출까지의 렌즈를 피할지. 기본 2 (PRD §6.6 "최근 노출 이력 고려"). */
  avoidRecentLensCount?: number;
}

/**
 * 날짜+userId로부터 오늘의 관찰 렌즈를 결정론적으로 고른다 — 같은 입력이면 항상 같은
 * 템플릿을 반환한다(새로고침·재요청에도 "오늘의 렌즈"가 바뀌지 않아야 함).
 * 최근 노출된 렌즈는 후보에서 제외하되, 그 결과 후보가 하나도 안 남으면(예: 활성
 * 템플릿이 매우 적을 때) 전체 활성 목록으로 되돌아간다 — 렌즈 다양성이 "오늘 렌즈가
 * 아예 없음"보다 우선순위가 낮다.
 */
export function selectTemplateForDate(params: SelectTemplateParams): TrainingTemplate {
  const {
    date,
    userId,
    templates,
    recentTemplateIds = [],
    avoidRecentLensCount = 2,
  } = params;

  const active = templates.filter((t) => t.active);
  if (active.length === 0) {
    throw new Error("활성 상태인 Daily Template이 없습니다.");
  }

  const recentLensTypes = new Set(
    recentTemplateIds
      .slice(0, avoidRecentLensCount)
      .map((id) => templates.find((t) => t.id === id)?.lensType)
      .filter((lens): lens is TrainingTemplate["lensType"] => Boolean(lens)),
  );

  const candidates = active.filter((t) => !recentLensTypes.has(t.lensType));
  const pool = candidates.length > 0 ? candidates : active;

  // 배열 순서 흔들림 없이 항상 같은 결과가 나오도록 id로 정렬한 뒤 해시로 고른다.
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));
  const seed = hashString(`${userId}:${date}`);
  const chosen = sorted[seed % sorted.length];
  if (!chosen) {
    throw new Error("unreachable: pool은 항상 비어 있지 않다");
  }
  return chosen;
}
