import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type BadgeVariant = "neutral" | "brand" | "ai" | "user" | "system" | "stale";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-warm-gray text-text-secondary",
  brand: "bg-brand-soft text-brand-strong",
  ai: "bg-brand-soft text-brand-strong",
  user: "bg-cream text-ink",
  /*
    text-tertiary(#6F766F)는 DESIGN.md 대비 표에서 `canvas` 위(4.56:1)만 검증돼 있다.
    더 어두운 `warm-gray`(#EEE8DE) 위에서는 3.83:1로 떨어져 WCAG AA(4.5:1)에 미달한다 —
    axe 검사로 실제 위반이 잡혔다. 토큰 값은 그대로 두고, 같은 배경에서 4.92:1이
    나오는 text-secondary로 짝을 바꾼다(neutral 변형이 이미 쓰는 조합이다).
  */
  system: "bg-warm-gray text-text-secondary",
  stale: "bg-warning-bg text-warning",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/**
 * DESIGN.md §17.3 Component Variants. 색만으로 구분하지 않는다(§14.2 접근성
 * 체크리스트) — 텍스트 Label이 항상 의미를 전달하고, 색은 보조 신호일 뿐이다.
 */
export function Badge({ variant = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-3 py-1 text-caption font-bold",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
