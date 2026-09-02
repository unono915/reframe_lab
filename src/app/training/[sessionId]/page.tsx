"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Stack } from "@/components/ui";
import {
  TrainingSessionProvider,
  useTrainingSession,
} from "@/features/training/TrainingSessionProvider";
import {
  DefinitionStage,
  ExplorationStage,
  FeedbackStage,
  ObservationStage,
  QuestioningStage,
  ReframingStage,
  SeparationStage,
} from "@/features/training/stages";

/**
 * Phase 2는 서버 저장이 없어(§14-B 미해결) URL의 [sessionId]를 실제 조회 키로 쓰지 않는다.
 * Provider가 로컬 상태에서 "오늘의 활성 세션"을 찾거나 만들고 나면, 그 실제 id로
 * URL만 맞춰준다(router.replace) — 새로고침해도 같은 주소로 돌아올 수 있게 하기 위함이다.
 * Phase 3에서 서버 세션 조회가 생기면 이 정합 로직은 필요 없어진다.
 */
function TrainingRouteSync() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const { status, snapshot, errorMessage, isSoloMode, enableSoloMode } = useTrainingSession();

  /**
   * `?solo=1`로 들어오면 이 세션을 "혼자 해보기"로 표시한다 (P1-6 전이 프로브).
   * 세션이 준비된 뒤에 한 번만 켠다 — 표식이 서버에 남아야 새로고침해도 유지된다.
   * 이미 켜져 있으면 서버 쪽에서 중복 기록하지 않는다.
   */
  const wantsSolo = searchParams.get("solo") === "1";
  useEffect(() => {
    if (status !== "ready" || !snapshot || !wantsSolo || isSoloMode) return;
    void enableSoloMode();
  }, [status, snapshot, wantsSolo, isSoloMode, enableSoloMode]);

  useEffect(() => {
    if (status !== "ready" || !snapshot) return;
    if (snapshot.session.status === "completed") {
      router.replace(`/result/${snapshot.session.id}`);
      return;
    }
    /*
      `?solo=1`은 표식이 실제로 스냅샷에 반영될 때까지 URL에 남겨둔다. 세션 로딩과
      표식 저장이 겹치면 나중에 도착한 로딩 응답이 방금 저장한 스냅샷을 덮어써서,
      사용자가 "코치 없이"를 눌렀는데 아무 표시도 안 나는 일이 실제로 있었다.
      파라미터를 남겨두면 위 effect가 다시 돌아 스스로 회복한다(서버 쪽은 멱등).
    */
    const soloQuery = wantsSolo && !isSoloMode ? "?solo=1" : "";
    const desiredPath = `/training/${snapshot.session.id}${soloQuery}`;
    const currentPath = `/training/${params.sessionId}${searchParams.get("solo") === "1" ? "?solo=1" : ""}`;
    if (currentPath !== desiredPath) {
      router.replace(desiredPath);
    }
  }, [status, snapshot, params.sessionId, router, wantsSolo, isSoloMode, searchParams]);

  if (status === "loading") {
    return (
      <main className="flex min-h-dvh items-center justify-center px-5">
        <p className="text-body text-text-secondary">오늘의 훈련을 준비하고 있어요.</p>
      </main>
    );
  }

  if (status === "error" || !snapshot) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-5">
        <Stack gap={2} align="center">
          <p className="text-body font-bold text-danger">세션을 불러오지 못했어요.</p>
          {errorMessage && (
            <p className="text-caption text-text-secondary">{errorMessage}</p>
          )}
        </Stack>
      </main>
    );
  }

  switch (snapshot.session.currentStage) {
    case "observation":
      return <ObservationStage />;
    case "separation":
      return <SeparationStage />;
    case "questioning":
      return <QuestioningStage />;
    case "exploration":
      return <ExplorationStage />;
    case "reframing":
      return <ReframingStage />;
    case "definition":
      return <DefinitionStage />;
    case "feedback":
      return <FeedbackStage />;
    default:
      return null;
  }
}

export default function TrainingPage() {
  return (
    <TrainingSessionProvider>
      <TrainingRouteSync />
    </TrainingSessionProvider>
  );
}
