import localFont from "next/font/local";

/**
 * NanumSquareRound (NAVER, SIL OFL 1.1) — DESIGN.md §5.1 확정 서체.
 * DEVELOPMENT_PLAN.md §14-K: @kfonts/nanum-square-round 패키지의 Regular(400)/Bold(700)만 사용한다.
 * next/font/local이 Fallback(Apple SD Gothic Neo)과의 metric 차이를 빌드 시점에 계산해
 * size-adjust 등을 자동 주입하므로 Layout Shift 보정을 별도로 구현하지 않는다.
 */
export const nanumSquareRound = localFont({
  src: [
    {
      path: "../../node_modules/@kfonts/nanum-square-round/NanumSquareRoundR.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@kfonts/nanum-square-round/NanumSquareRoundB.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-nanum-square-round",
  fallback: ["Apple SD Gothic Neo", "system-ui", "sans-serif"],
  display: "swap",
  preload: true,
});
