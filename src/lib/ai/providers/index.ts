import type { CoachProvider } from "../provider";
import { mockCoachProvider } from "./mock";

/**
 * 실제 제공자 연결 지점(§14-D). API Key가 없으면 Mock을 그대로 쓴다 — AI가 죽어도
 * 세션은 완주할 수 있어야 한다는 원칙(CLAUDE.md §3 원칙 8)의 기본값이 Mock인 셈이다.
 * §14-D 결정 후 실제 Provider Adapter 파일을 추가하고 이 분기만 바꾸면 된다 —
 * 호출자(app/api/sessions/[id]/coach 등)는 `CoachProvider` 인터페이스만 알면 된다.
 */
export function getActiveCoachProvider(): CoachProvider {
  // TODO(§14-D): AI_PROVIDER_API_KEY가 설정되면 실제 Provider Adapter를 반환한다.
  return mockCoachProvider;
}
