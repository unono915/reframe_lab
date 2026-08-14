"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
  const { status, snapshot, errorMessage } = useTrainingSession();

  useEffect(() => {
    if (status !== "ready" || !snapshot) return;
    if (snapshot.session.status === "completed") {
      router.replace(`/result/${snapshot.session.id}`);
      return;
    }
    if (params.sessionId !== snapshot.session.id) {
      router.replace(`/training/${snapshot.session.id}`);
    }
  }, [status, snapshot, params.sessionId, router]);

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
