"use client";

import { useCallback, useRef, useState } from "react";
import { toDisplayMessage } from "@/lib/fetch-json";

/**
 * 훈련 화면의 **보조 동작**(항목 추가, 확인 토글, 자기 점검 저장, 이전 단계 수정)이
 * 실패했을 때 사용자에게 알리고 지운 입력을 되돌리기 위한 훅.
 *
 * 왜 필요한가: 이 화면들은 전부 "입력창을 먼저 비우고 → 저장을 기다린다"는 순서를
 * 쓴다. 연속 입력 시 뒤늦은 초기화가 다음 입력을 지우는 문제를 피하려고 일부러
 * 그렇게 만든 것인데, 그 대가로 **저장이 실패하면 사용자가 쓴 문장이 화면에서도
 * 사라진다.** 게다가 await 뒤의 줄들(폼 닫기, "저장됨" 표시)이 성공을 전제로 쓰여
 * 있어서, 실패가 성공처럼 보이기까지 했다 — `PastStagesSummary`는 아무것도 저장되지
 * 않았는데 "저장됨"을 띄웠다.
 *
 * 주 버튼(다음)은 `StageShell`이 같은 역할을 이미 하고 있다. 이 훅은 그 밖의
 * 버튼들에 같은 보장을 준다 — CLAUDE.md 원칙 7(입력 유실 금지)과, 이 프로젝트에서
 * 반복해서 재발한 "버튼이 조용히 아무 반응도 하지 않는다" 증상에 대한 대응이다.
 */
export interface MutationAction {
  /**
   * `task`를 실행하고 성공 여부를 boolean으로 돌려준다. 실패하면 `error`에 한국어
   * 문장이 담기고 `rollback`이 호출된다 — 성공을 전제로 한 뒷정리(폼 닫기 등)는
   * 반환값이 true일 때만 하도록 호출부에서 분기한다.
   */
  run(task: () => Promise<unknown>, rollback?: () => void): Promise<boolean>;
  pending: boolean;
  error: string | null;
  clearError(): void;
}

export function useMutationAction(): MutationAction {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 같은 버튼을 연타해도 한 번만 보낸다 — 큐가 직렬화해주긴 하지만, 중복 항목이
  // 실제로 두 개 저장되는 것까지 막아주지는 않는다.
  const inFlightRef = useRef(false);

  const run = useCallback(
    async (task: () => Promise<unknown>, rollback?: () => void): Promise<boolean> => {
      if (inFlightRef.current) return false;
      inFlightRef.current = true;
      setPending(true);
      setError(null);
      try {
        await task();
        return true;
      } catch (err) {
        setError(toDisplayMessage(err));
        rollback?.();
        return false;
      } finally {
        inFlightRef.current = false;
        setPending(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  return { run, pending, error, clearError };
}
