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

export type FetchResult<T> = { ok: true; data: T } | { ok: false; message: string };

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

export async function fetchJson<T>(
  input: string,
  init?: RequestInit,
): Promise<FetchResult<T>> {
  let response: Response;
  try {
    response = await fetch(input, init);
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
    const message = (body as ApiErrorBody | null)?.message;
    return { ok: false, message: message ?? UNKNOWN_ERROR_MESSAGE };
  }
  if (body === null) return { ok: false, message: UNKNOWN_ERROR_MESSAGE };

  return { ok: true, data: body as T };
}
