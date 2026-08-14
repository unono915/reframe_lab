import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

/**
 * DESIGN.md §9.1. 한 화면에서 Primary는 하나만 두는 것은 사용처에서 지켜야 하는 규칙이며
 * 이 컴포넌트는 강제하지 않는다.
 */
const variantClasses: Record<ButtonVariant, string> = {
  primary: cn(
    "bg-brand-soft text-brand-strong",
    "hover:bg-brand-soft-hover active:bg-brand-soft-pressed",
    "disabled:bg-warm-gray disabled:text-text-tertiary disabled:active:scale-100",
  ),
  secondary: cn("bg-cream text-ink", "disabled:bg-warm-gray disabled:text-text-tertiary"),
  tertiary: cn(
    "bg-transparent text-brand-strong",
    "hover:bg-brand-soft active:bg-brand-soft-pressed",
    "disabled:text-text-tertiary disabled:bg-transparent",
  ),
  destructive: cn(
    "bg-danger-bg text-danger",
    "disabled:bg-warm-gray disabled:text-text-tertiary",
  ),
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", fullWidth = false, className, disabled, children, ...props },
  ref,
) {
  const isTertiary = variant === "tertiary";

  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-button",
        "text-body font-bold",
        "transition-[background-color,transform] duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
        "disabled:cursor-not-allowed",
        isTertiary ? "h-11 min-w-11 px-4" : "h-[var(--size-button-height)] px-6",
        !disabled && "active:scale-[0.985]",
        fullWidth && "w-full",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
