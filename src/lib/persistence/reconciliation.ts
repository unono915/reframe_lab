import type { Stage } from "@/domain/types";
import type { DraftRecord } from "./drafts";

/**
 * §7.5 복구 우선순위의 3번째 경우("서로 다른 기기 수정이 감지되어 자동 병합이
 * 위험하면 양쪽 텍스트를 모두 보존") 실제 구현. 서버 확정 `currentStage`보다
 * 앞선 단계의 로컬 초안이 이 세션 id로 남아있다면, 다른 기기(또는 다른 탭)가
 * 이미 그 단계를 지나갔다는 뜻이다 — 이 기기의 미제출 입력을 조용히 버리지 않고
 * 사용자에게 보여준 뒤 명시적으로 지우게 한다(단순 timestamp 비교로 자동 폐기 금지).
 */
export function findConflictingDrafts(
  drafts: DraftRecord[],
  currentStage: Stage,
  stageOrder: readonly Stage[],
): DraftRecord[] {
  const currentIndex = stageOrder.indexOf(currentStage);
  return drafts.filter((draft) => {
    const draftIndex = stageOrder.indexOf(draft.stage);
    return draftIndex !== -1 && draftIndex < currentIndex;
  });
}
