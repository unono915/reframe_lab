"use client";

import { Button } from "./Button";
import { Stack } from "./Stack";

/**
 * 화면 전체가 서버 응답을 기다리는 동안(그리고 실패했을 때) 보여주는 공용 상태 화면.
 *
 * 오류일 때 **반드시 재시도 경로를 준다** — DEVELOPMENT_PLAN.md Phase 6 "오류 복구:
 * 무엇이 실패했고 다음에 무엇을 할 수 있는지". 이게 없던 동안 API가 한 번 실패하면
 * 화면이 로딩 문구에서 영영 멈춰 새로고침 말고는 빠져나갈 방법이 없었다.
 */
export function PageState({
  status,
  message,
  onRetry,
  loadingLabel = "불러오고 있어요.",
}: {
  status: "loading" | "error";
  message?: string;
  onRetry?: () => void;
  loadingLabel?: string;
}) {
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-[640px] flex-col items-center justify-center gap-4 px-5">
      {status === "loading" ? (
        <p className="text-body text-text-secondary" role="status">
          {loadingLabel}
        </p>
      ) : (
        <Stack gap={4} align="center">
          <p role="alert" className="text-center text-body text-ink">
            {message ?? "잠시 문제가 생겼어요."}
          </p>
          {onRetry && (
            <Button type="button" variant="primary" onClick={onRetry}>
              다시 시도
            </Button>
          )}
        </Stack>
      )}
    </main>
  );
}
