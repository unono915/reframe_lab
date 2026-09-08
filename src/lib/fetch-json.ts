import { trackedFetch } from "./network-status";

/**
 * 화면(app/**, features/**)이 Route Handler를 호출할 때 쓰는 공용 래퍼.
 *
 * 이게 없던 동안 Home·History·Growth가 전부 `res.json()`을 곧바로 호출했다. 응답이
 * 2xx가 아니거나(500) 본문이 비어 있으면 `json()`이 SyntaxError를 던지는데, 그 자리에
 * catch가 없어 unhandled rejection이 되고 화면은 "불러오고 있어요"에서 영영 멈췄다 —
 * 재시도 버튼도, 무엇이 잘못됐다는 안내도 없었다. 실제로 Supabase JWT 시각 오차로
 * 500이 한 번 나면서 Home 전체가 그렇게 멈추는 것을 재현했다.
 *
 * 그래서 이 함수는 **절대 throw하지 않는다.** 성공·실패를 값으로 돌려주고, 실패
 * 메시지는 항상 사용자에게 그대로 보여줄 수 있는 한국어 문장이다.
 */

/** 네트워크 자체가 끊긴 경우. 입력 보존 여부를 함께 알린다(DESIGN.md §11 오류 복구). */
export const NETWORK_ERROR_MESSAGE =
  "인터넷 연결이 불안정해요. 작성한 내용은 이 기기에 저장돼 있어요.";

const UNKNOWN_ERROR_MESSAGE = "잠시 문제가 생겼어요. 작성한 내용은 그대로 있어요.";

/**
 * 사용자에게 그대로 보여줘도 되는 메시지를 담은 오류.
 *
 * 브라우저·라이브러리가 던지는 영어 예외와 구분하기 위해 쓴다. 구분이 없으면
 * catch 한 곳에서 둘이 섞여 "TypeError: Failed to fetch"가 한국어 화면에 그대로
 * 뜬다 — 실제로 훈련 화면과 세션 로딩 두 곳에서 그랬다(DESIGN.md §15.2는 오류
 * 문구를 "원인과 다음 행동을 구체적으로 설명"하도록 규정한다).
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

/** 우리가 쓴 메시지는 그대로, 그 밖의 예외는 사용자 문장으로 바꾼다. */
export function toDisplayMessage(error: unknown): string {
  return error instanceof UserFacingError ? error.message : toUserMessage(error);
}

export type FetchResult<T> =
  | { ok: true; data: T }
  /**
   * `errorCode`는 서버가 준 분류다(`lib/errors.ts`). 문구는 그대로 보여주면 되지만,
   * **다시 시도해서 달라지는 실패인지**는 호출부가 알아야 할 때가 있다 — 없는 기록에
   * "다시 시도"만 주면 몇 번을 눌러도 같은 화면에 남는다. 네트워크 단절처럼 서버가
   * 대답하지 못한 경우에는 없다.
   */
  | { ok: false; message: string; errorCode?: string };

interface ApiErrorBody {
  errorCode?: string;
  message?: string;
}

/**
 * 예외를 사용자에게 보여줄 한국어 문장으로 바꾼다. 브라우저가 던지는 `TypeError:
 * Failed to fetch` 같은 영어 원문을 그대로 노출하지 않기 위한 경계다 — 실제로
 * 훈련 화면에서 네트워크를 끊었을 때 사용자에게 "Failed to fetch"가 보였다.
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof TypeError) return NETWORK_ERROR_MESSAGE;
  return UNKNOWN_ERROR_MESSAGE;
}

/**
 * 세션이 풀렸을 때 로그인 화면으로 보낸다.
 *
 * 낮은 층의 fetch 헬퍼가 화면을 이동시키는 것은 조심스러운 일이지만, 대안은 모든
 * 호출부가 401을 각자 처리하는 것이고 그러면 한 곳만 빠뜨려도 사용자는 "잠시 문제가
 * 생겼어요" 앞에 갇힌다 — 재시도 버튼을 아무리 눌러도 달라지지 않는 화면이다.
 * 401은 재시도로 풀리지 않는 유일한 실패라 여기서 한 번에 처리하는 편이 맞다.
 *
 * `next`에 지금 경로를 담아 로그인 후 원래 자리로 돌아오게 한다.
 */
function goToLogin(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/auth/")) return;
  const next = `${window.location.pathname}${window.location.search}`;
  // 일부러 **전체 새로고침**으로 이동한다. router.push는 클라이언트 상태를 그대로
  // 안고 가는데, 지금 그 상태는 사라진 세션으로 만든 스냅샷·캐시라 남겨두면 안 된다.
  // (그리고 이 함수는 컴포넌트가 아니라 훅을 쓸 수 없다.)
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/auth/login?next=${encodeURIComponent(next)}`);
}

/**
 * 세션 만료 응답이면 로그인 화면으로 보내고 true를 돌려준다. 서버는 항상
 * `unauthorized` 코드와 401을 함께 보낸다(lib/errors.ts, supabase/middleware.ts).
 */
export function handleUnauthorized(status: number, body: unknown): boolean {
  const unauthorized =
    status === 401 || (body as ApiErrorBody | null)?.errorCode === "unauthorized";
  if (unauthorized) goToLogin();
  return unauthorized;
}

export async function fetchJson<T>(
  input: string,
  init?: RequestInit,
): Promise<FetchResult<T>> {
  let response: Response;
  try {
    // trackedFetch를 쓰는 이유: 실패·성공을 오프라인 배너가 함께 본다. 브라우저의
    // `navigator.onLine`만으로는 "인터페이스는 붙어 있는데 요청은 죽는" 경우를
    // 놓친다(lib/network-status.ts).
    response = await trackedFetch(input, init);
  } catch {
    // fetch가 reject하는 경우는 사실상 네트워크 단절뿐이다(CORS·중단 포함).
    return { ok: false, message: NETWORK_ERROR_MESSAGE };
  }

  // 204 No Content처럼 본문이 없는 성공 응답은 파싱하지 않는다.
  if (response.status === 204) return { ok: true, data: undefined as T };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const errorBody = body as ApiErrorBody | null;
    // 세션이 풀린 경우는 재시도로 풀리지 않는다 — 로그인 화면으로 보낸다.
    handleUnauthorized(response.status, body);
    return {
      ok: false,
      message: errorBody?.message ?? UNKNOWN_ERROR_MESSAGE,
      errorCode: errorBody?.errorCode,
    };
  }
  if (body === null) return { ok: false, message: UNKNOWN_ERROR_MESSAGE };

  return { ok: true, data: body as T };
}
