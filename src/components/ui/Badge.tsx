import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type BadgeVariant = "neutral" | "brand" | "ai" | "user" | "system" | "stale";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-warm-gray text-text-secondary",
  brand: "bg-brand-soft text-brand-strong",
  ai: "bg-brand-soft text-brand-strong",
  user: "bg-cream text-ink",
  system: "bg-warm-gray text-text-tertiary",
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
