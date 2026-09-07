"use client";

import { useEffect, useState } from "react";
import { useSerwist } from "@serwist/turbopack/react";
import { Button, Card, Stack } from "@/components/ui";

/**
 * 새 버전이 받아졌을 때 알려주는 배너 (DESIGN.md §11 "Update Ready" — Neutral
 * Inline Banner + 지정 문구).
 *
 * `skipWaiting`을 끈 이유가 여기서 완성된다. 새 Service Worker를 자동 활성화하면
 * 작성 중인 훈련 세션이 강제로 새로고침돼 입력을 잃을 수 있어서 끄고 있었는데
 * (원칙 7), 그 대신 **사용자에게 알려주는 UI가 없어서** 설치형 PWA 사용자는 탭을
 * 전부 닫기 전까지 영영 옛 버전에 머물렀다 — 버그를 고쳐도 전달되지 않는 상태였다.
 *
 * 그래서 새로고침은 오직 사용자가 눌렀을 때만 일어난다. 자동으로는 절대 하지 않는다.
 */
export function AppUpdateBanner() {
  const { serwist } = useSerwist();
  const [updateReady, setUpdateReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!serwist) return;

    const onWaiting = () => setUpdateReady(true);
    // 새 워커가 페이지를 넘겨받은 뒤에야 새로고침한다 — 그래야 새 버전으로 뜬다.
    const onControlling = () => window.location.reload();

    serwist.addEventListener("waiting", onWaiting);
    serwist.addEventListener("controlling", onControlling);
    return () => {
      serwist.removeEventListener("waiting", onWaiting);
      serwist.removeEventListener("controlling", onControlling);
    };
  }, [serwist]);

  if (!updateReady || dismissed) return null;

  return (
    <div
      role="status"
      className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-50 px-5 pb-4"
    >
      <Card variant="neutral" className="pointer-events-auto mx-auto max-w-[640px]">
        <Stack gap={3}>
          <p className="text-body text-ink">
            새 버전이 준비됐어요. 작성 중인 내용을 저장한 뒤 업데이트할 수 있어요.
          </p>
          <Stack direction="row" gap={2}>
            <Button
              type="button"
              variant="primary"
              disabled={updating}
              onClick={() => {
                setUpdating(true);
                serwist?.messageSkipWaiting();
              }}
            >
              {updating ? "업데이트 중" : "지금 업데이트"}
            </Button>
            <Button type="button" variant="tertiary" onClick={() => setDismissed(true)}>
              나중에
            </Button>
          </Stack>
        </Stack>
      </Card>
    </div>
  );
}
