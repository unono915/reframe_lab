"use client";

import { useEffect, useRef, useState } from "react";
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
  /**
   * 사용자가 '지금 업데이트'를 눌렀는지. state가 아니라 ref인 이유는 아래 이벤트
   * 핸들러가 등록 시점의 값을 붙잡고 있으면 안 되기 때문이다.
   */
  const userAskedToUpdate = useRef(false);

  useEffect(() => {
    if (!serwist) return;

    const onWaiting = () => setUpdateReady(true);

    /**
     * `controlling`은 "새 워커가 이 페이지를 넘겨받았다"는 신호인데, 업데이트일
     * 때만 오는 게 아니다 — sw.ts가 `clientsClaim: true`라 **맨 처음 설치될 때도**
     * 온다. 조건 없이 새로고침했더니 앱을 처음 여는 사람의 페이지가 로그인 도중에
     * 리로드됐다(입력하던 값이 날아갈 수 있는 자리다. 실제로 E2E 로그인이 이것
     * 때문에 실패해서 발견했다).
     *
     * 그래서 사용자가 직접 업데이트를 누른 경우에만 새로고침한다.
     */
    const onControlling = () => {
      if (userAskedToUpdate.current) window.location.reload();
    };

    serwist.addEventListener("waiting", onWaiting);
    serwist.addEventListener("controlling", onControlling);
    return () => {
      serwist.removeEventListener("waiting", onWaiting);
      serwist.removeEventListener("controlling", onControlling);
    };
  }, [serwist]);

  if (!updateReady || dismissed) return null;

  return (
    // 화면 하단 고정 배치는 `AppBanners`가 맡는다 — 오프라인 배너와 겹치지 않게
    // 한 줄로 쌓기 위해서다. 여기서는 카드 자체만 그린다.
    <div role="status" className="mx-auto mt-2 w-full max-w-[640px]">
      <Card variant="neutral" className="pointer-events-auto">
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
                userAskedToUpdate.current = true;
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
