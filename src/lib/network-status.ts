/**
 * "지금 서버에 닿는가"를 한 곳에서 판단한다.
 *
 * 처음에는 `navigator.onLine`만 봤다. 그런데 그 값은 **브라우저가 네트워크 인터페이스를
 * 어떻게 보는지**일 뿐, 우리 서버에 닿는지가 아니다. 실제로 요청이 전부
 * `net::ERR_FAILED`로 죽는 상황에서도 `navigator.onLine === true`인 경우를 확인했다
 * (2026-09-08, 오프라인 상태로 앱을 연 뒤 측정). 캡티브 포털(로그인 안 한 공용 와이파이)도
 * 같은 모양이다 — 인터페이스는 붙어 있고 요청만 가로채인다.
 *
 * 그래서 두 가지를 합쳐서 본다.
 * 1. 브라우저가 말하는 상태 (`online`/`offline` 이벤트)
 * 2. **실제로 관측한 요청 결과** — fetch가 네트워크 단계에서 실패하면 지금은 닿지
 *    않는 것이고, 응답을 하나라도 받으면 닿는 것이다.
 *
 * 2번이 1번을 이긴다. 추측보다 관측이 정확하다.
 */

type Listener = (offline: boolean) => void;

const listeners = new Set<Listener>();
/** 마지막 요청이 네트워크 단계에서 실패했는가. */
let observedFailure = false;
let windowListenersAttached = false;

export function isOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  return observedFailure || !navigator.onLine;
}

function emit(): void {
  const offline = isOffline();
  for (const listener of listeners) listener(offline);
}

/** fetch가 응답을 받기도 전에 실패했다 — 상태 코드가 아니라 연결 자체의 문제다. */
export function reportNetworkFailure(): void {
  if (observedFailure) return;
  observedFailure = true;
  emit();
}

/** 응답을 받았다. 4xx·5xx여도 서버에는 닿은 것이므로 오프라인이 아니다. */
export function reportNetworkSuccess(): void {
  if (!observedFailure) return;
  observedFailure = false;
  emit();
}

export function subscribeNetworkStatus(listener: Listener): () => void {
  listeners.add(listener);

  if (!windowListenersAttached && typeof window !== "undefined") {
    windowListenersAttached = true;
    // 브라우저가 상태를 바꿨다고 알려주면 관측 기록은 지운다 — 낡은 판단을 붙들고
    // 있지 않기 위해서다. 다음 요청이 실패하면 다시 켜진다.
    window.addEventListener("online", () => {
      observedFailure = false;
      emit();
    });
    window.addEventListener("offline", emit);
  }

  return () => {
    listeners.delete(listener);
  };
}

/**
 * 결과를 관측해 상태에 반영하는 `fetch`. 네트워크 판단이 필요한 호출은 전부 이걸 쓴다 —
 * 호출부마다 따로 보고하게 하면 한 곳만 빠뜨려도 배너가 거짓말을 한다.
 */
export async function trackedFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(input, init);
    reportNetworkSuccess();
    return response;
  } catch (error) {
    reportNetworkFailure();
    throw error;
  }
}

/** 테스트용 초기화. 모듈 수준 상태를 쓰므로 테스트 사이에 비워줘야 한다. */
export function resetNetworkStatusForTest(): void {
  observedFailure = false;
  listeners.clear();
}
