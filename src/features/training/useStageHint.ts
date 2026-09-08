"use client";

import { useState } from "react";
import type { HintLevel, Stage } from "@/domain/types";
import { hasMinimalUserInput } from "@/domain/training/requirements";
import { toDisplayMessage } from "@/lib/fetch-json";
import { useTrainingSession } from "./TrainingSessionProvider";

/**
 * 한 단계에서 "코치에게 질문 하나 받기"를 다루는 상태.
 *
 * 왜 훅으로 빼는가 — 짧지만 **틀리기 쉬운 자리가 넷** 있고, 화면마다 다시 쓰면 한 곳만
 * 어긋나도 눈에 띄지 않는다.
 *
 * 1. **단계 계산.** "다음에 요청할 단계"와 "지금까지 본 단계"는 다른 값이다. 하나로
 *    겸하면 첫 힌트(Level 0)를 받은 뒤 쓴 질문에 **본 적 없는 Level 1**이 기록된다
 *    (실제로 그랬다). 실패한 요청은 세지 않는다 — 보지 못한 힌트를 썼다고 하면 안 된다.
 * 2. **User-first gate(원칙 1).** 서버는 `hasMinimalUserInput`으로 거절한다. 화면이
 *    다른 조건으로 버튼을 열면 "눌렀는데 거절당하는" 막다른 길이 생긴다 — 예외 경로에서
 *    실제로 그랬다. 그래서 **같은 순수 함수**로 판정한다.
 * 3. **아직 서버에 없는 입력.** 관찰·탐색·정의 단계는 "다음"을 누를 때 한꺼번에
 *    저장한다. 그래서 사용자가 화면 가득 써놓아도 서버의 스냅샷은 비어 있고, 서버 기준
 *    으로만 판정하면 **그 세 단계에서는 버튼이 영영 열리지 않는다.** 사용자가 먼저 쓴
 *    것은 사실이므로, 부르기 직전에 그 입력을 저장하고(`ensureSaved`) 묻는다.
 * 4. **침묵.** "힌트를 눌렀는데 아무 일도 일어나지 않는다"는 이 저장소에서 네 번
 *    재발했다. 대기·오류·결과 중 하나는 반드시 화면에 남아야 한다.
 */
export interface StageHint {
  /** 지금 코치를 부를 수 있는가. 혼자 하기 모드이거나 아직 안 썼으면 false. */
  canRequest: boolean;
  pending: boolean;
  error: string | null;
  question: string | null;
  /** 지금까지 실제로 본 가장 강한 단계. 예외 경로의 조건이기도 하다. */
  usedHintLevel: HintLevel;
  request: () => Promise<void>;
  /** 사용자가 그 단계에 무언가를 더 쓰면 지난 질문은 치운다. */
  clear: () => void;
}

export interface StageHintOptions {
  /**
   * 화면에는 썼지만 아직 서버에 없는 입력이 있는가. 있으면 버튼을 연다.
   * 없으면 서버 스냅샷만으로 판정한다.
   */
  hasUnsavedInput?: boolean;
  /**
   * 부르기 직전에 그 입력을 서버에 확정한다. 실패하면 코치를 부르지 않고 오류를 보인다 —
   * 저장되지 않은 채 물으면 서버가 "먼저 작성해주세요"로 거절해서, 방금 한 화면 가득
   * 쓴 사람에게 아무 말도 안 썼다는 안내가 나간다.
   */
  ensureSaved?: () => Promise<void>;
}

export function useStageHint(
  stage: Exclude<Stage, "not_started">,
  options: StageHintOptions = {},
): StageHint {
  const { snapshot, isSoloMode, requestHint } = useTrainingSession();
  const [received, setReceived] = useState(0);
  const [question, setQuestion] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextHintLevel = Math.min(received, 2) as HintLevel;
  const usedHintLevel = Math.max(received - 1, 0) as HintLevel;

  async function request(): Promise<void> {
    setPending(true);
    setError(null);
    if (options.ensureSaved) {
      try {
        await options.ensureSaved();
      } catch (cause) {
        setPending(false);
        setError(toDisplayMessage(cause));
        return;
      }
    }
    const result = await requestHint(nextHintLevel);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setQuestion(result.question);
    setReceived((count) => count + 1);
  }

  const savedInputExists = Boolean(snapshot && hasMinimalUserInput(stage, snapshot));

  return {
    canRequest: !isSoloMode && (savedInputExists || Boolean(options.hasUnsavedInput)),
    pending,
    error,
    question,
    usedHintLevel,
    request,
    clear: () => setQuestion(null),
  };
}
