"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * 연결이 끊겼을 때 알려주는 배너 (DESIGN.md §11 "Offline Draft", §17.3 Status Banner
 * `offline` variant, 색 토큰은 §4.5의 `offline`).
 *
 * 왜 필요한가: 오프라인에서 "다음 질문으로"를 누르면 저장이 실패하고 오류 문구가
 * 뜬다. 문구 자체는 정확하지만, **왜** 실패했는지는 그 순간에야 알게 된다 —
 * 사용자는 앱이 고장 났다고 읽는다. 상태를 미리 보여주면 실패가 예상 가능한 일이 된다.
 *
 * 자동으로 새로고침하거나 다시 보내지 않는다. 연결이 돌아왔을 때 무엇을 다시 할지는
 * 사용자가 정한다 — `reloadOnOnline`을 끈 것과 같은 이유다(작성 중인 세션이 강제로
 * 새로고침되면 안 된다, 원칙 7).
 *
 * `navigator.onLine`은 "네트워크 인터페이스가 붙어 있는가"만 알려주므로 캡티브 포털
 * 같은 경우를 잡지 못한다. 그런 경우는 저장 실패 문구가 받아낸다 — 이 배너는 확실히
 * 끊긴 경우를 미리 알려주는 용도이지, 연결 품질의 유일한 판단 근거가 아니다.
 */
export function OfflineBanner() {
  // 서버 렌더 시점에는 알 수 없다. 초기값을 online으로 두어 hydration 불일치를 피하고,
  // 실제 값은 마운트 후 이벤트로 맞춘다.
  const [offline, setOffline] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  // 훈련 중에는 "쓴 것이 어디 있는지"가 가장 궁금한 정보다(DESIGN.md §11 권장 문구).
  // 목록·성장 화면에서는 남길 초안이 없으므로 그 문장이 오히려 헷갈린다.
  const message = pathname?.startsWith("/training")
    ? "오프라인이에요. 작성한 내용은 이 기기에 남겨둘게요."
    : "오프라인이에요. 연결되면 다시 불러올게요.";

  return (
    <div
      role="status"
      className="pointer-events-auto mx-auto mt-2 w-full max-w-[640px] rounded-card bg-offline-bg px-4 py-3"
    >
      <p className="text-label font-bold text-offline">{message}</p>
    </div>
  );
}
