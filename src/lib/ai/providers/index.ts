import type { CoachProvider } from "../provider";
import { mockCoachProvider } from "./mock";
import { upstageCoachProvider } from "./upstage";

/**
 * 실제 제공자 연결 지점(§14-D, 2026-08-26 확정: Upstage solar-pro4). API Key가
 * 없으면 Mock을 그대로 쓴다 — AI가 죽어도 세션은 완주할 수 있어야 한다는
 * 원칙(CLAUDE.md §3 원칙 8)의 기본값이 Mock인 셈이다. 호출자(app/api/sessions/[id]/coach
 * 등)는 `CoachProvider` 인터페이스만 알면 되고, 제공자를 바꾸려면 이 분기만 바꾸면 된다.
 */
export function getActiveCoachProvider(): CoachProvider {
  if (process.env.UPSTAGE_API_KEY?.trim()) {
    return upstageCoachProvider;
  }
  return mockCoachProvider;
}
