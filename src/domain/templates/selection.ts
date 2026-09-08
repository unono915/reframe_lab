import type { TrainingTemplate } from "@/domain/types";

/**
 * 사용자 시간대 기준 오늘 날짜(YYYY-MM-DD). 서버와 클라이언트 양쪽에서 같은 함수를
 * 써야 "오늘의 렌즈"가 어긋나지 않는다 — `Intl`은 브라우저·Node 모두에 있는 표준
 * 기능이라 domain/의 "프레임워크 의존 없음" 원칙을 어기지 않는다.
 */
export function todayDateString(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch {
    /*
      `Intl`은 모르는 시간대를 받으면 `RangeError`를 던진다. 이 값은 브라우저가
      보고한 것을 그대로 서버까지 들고 온 것이라, 이상한 값이 오는 경로가 실제로
      있다 — 지문 방지 설정이 켜진 브라우저, 오래된 런타임, 그리고 주소창에서 쿼리를
      고친 사람.

      던지게 두면 홈·성장·오늘의 렌즈가 **한꺼번에 500으로 죽는다.** 화면에는 "잠시
      문제가 생겼어요"만 뜨고, 사용자는 자기 브라우저의 시간대 설정이 원인이라는 것을
      알 방법이 없다. 그래서 라우트들이 이미 쓰고 있는 기본값(UTC)으로 물러난다 —
      날짜가 하루 어긋날 수는 있어도 앱은 계속 쓸 수 있다.
    */
    return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
  }
}

/**
 * 저장하기 전에 시간대 값을 정리한다. `todayDateString`이 스스로 물러날 수 있어도,
 * **못 쓰는 값을 DB에 넣어두면 나중에 읽는 쪽이 같은 문제를 다시 겪는다.**
 */
export function resolveTimeZone(timezone: string | null | undefined): string {
  if (!timezone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

/** FNV-1a 32bit — 암호학적 용도가 아니라 결정론적 분산에만 쓴다. */
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * 오늘의 렌즈를 고를 때 "최근에 본 것"으로 치는 개수. 호출하는 세 라우트가 같은 값을
 * 써야 하므로 여기 한 곳에 둔다.
 *
 * 12로 정한 근거는 실측이다. 90일을 돌려보니 5일 때는 24개 중 22개만 나오고 같은
 * 문장이 6일 만에 돌아왔는데, 12로 늘리면 **24개가 전부 나오고 최소 간격이 13일**이
 * 된다. 하루 한 번 쓰는 앱이라 2주에 한 번 이상은 같은 문장을 만나지 않는다는 뜻이다.
 * 후보가 부족해질 걱정은 없다 — 24개에서 12개와 최근 렌즈를 빼도 여덟 개는 남고,
 * 그마저 비면 `selectTemplateForDate`가 단계적으로 물러난다.
 */
export const RECENT_TEMPLATE_WINDOW = 12;

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

  /*
    최근에 **그 문장 자체**를 본 것도 피한다.

    예전에는 최근 렌즈 유형 두 개만 걸렀다. 렌즈는 8종뿐이라 그 뒤에도 후보가 18개쯤
    남고, 해시는 지난 선택을 기억하지 않으므로 같은 템플릿이 며칠 만에 다시 나온다 —
    60일을 돌려보니 한 문장이 2일·7일·10일에 세 번 나왔고, 24개 중 2개는 한 번도
    나오지 않았다. 사용자가 겪는 것은 렌즈 유형이 아니라 그 문장이라, "어제 본 걸 또
    보네"가 되는 자리다.

    PRD §6.6은 "같은 렌즈가 지나치게 반복되지 않도록 최근 노출 이력을 고려한다"고
    적는다. 렌즈 조건은 그대로 두고, 이미 넘겨받고 있던 최근 템플릿 id를 함께 쓴다.

    비우지 않는 것이 원칙이라 단계적으로 물러난다 — 문장까지 피할 수 없으면 렌즈만,
    그것도 안 되면 전체에서 고른다. 오늘의 렌즈가 없는 화면을 만들지 않기 위해서다.
  */
  const recentIds = new Set(recentTemplateIds);
  // 렌즈 회피가 PRD §6.6이 정한 조건이므로 **그것을 먼저** 적용하고, 그 안에서만
  // 최근 문장을 덜어낸다. 순서를 뒤집으면 "문장을 피하려고 같은 렌즈를 다시 주는" 일이
  // 생긴다 — 후보가 적은 데이터 집합에서 실제로 그렇게 됐다(기존 테스트가 잡았다).
  const byLens = active.filter((t) => !recentLensTypes.has(t.lensType));
  const fresh = byLens.filter((t) => !recentIds.has(t.id));
  const pool = fresh.length > 0 ? fresh : byLens.length > 0 ? byLens : active;

  // 배열 순서 흔들림 없이 항상 같은 결과가 나오도록 id로 정렬한 뒤 해시로 고른다.
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));
  const seed = hashString(`${userId}:${date}`);
  const chosen = sorted[seed % sorted.length];
  if (!chosen) {
    throw new Error("unreachable: pool은 항상 비어 있지 않다");
  }
  return chosen;
}
