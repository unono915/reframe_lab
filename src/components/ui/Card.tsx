import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type CardVariant =
  "daily" | "paper" | "cream" | "coach" | "neutral" | "interactive";

const variantClasses: Record<CardVariant, string> = {
  daily: "bg-cream p-6 md:p-8",
  paper: "bg-paper border border-border p-6",
  cream: "bg-cream p-6",
  coach: "bg-brand-soft p-5",
  neutral: "bg-warm-gray p-6",
  interactive: "bg-paper border border-border p-6 text-left hover:bg-brand-quiet",
};

interface CardOwnProps {
  variant?: CardVariant;
  className?: string;
  children: ReactNode;
}

export type CardProps =
  | (CardOwnProps & { variant?: Exclude<CardVariant, "interactive"> } & Omit<
        HTMLAttributes<HTMLDivElement>,
        "className" | "children"
      >)
  | (CardOwnProps & { variant: "interactive" } & Omit<
        ButtonHTMLAttributes<HTMLButtonElement>,
        "className" | "children"
      >);

/**
 * DESIGN.md §9.3. Card 안 Card 중첩은 최대 1단계, Shadow는 항상 none.
 * `variant="interactive"`는 button으로 렌더링되어 클릭 가능한 Card가 명확한 단일 Action이 되도록 한다.
 */
export function Card({ variant = "paper", className, children, ...props }: CardProps) {
  const classes = cn("rounded-card", variantClasses[variant], className);

  if (variant === "interactive") {
    return (
      <button
        type="button"
        className={classes}
        {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={classes} {...(props as HTMLAttributes<HTMLDivElement>)}>
      {children}
    </div>
  );
}
