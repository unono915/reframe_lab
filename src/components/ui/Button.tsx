import { forwardRef } from "react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";

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

function buttonClasses(
  variant: ButtonVariant,
  fullWidth: boolean,
  disabled: boolean,
  className?: string,
) {
  const isTertiary = variant === "tertiary";
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-button",
    "text-body font-bold",
    "transition-[background-color,transform] duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
    "disabled:cursor-not-allowed",
    isTertiary
      ? "h-[var(--size-touch-min)] min-w-[var(--size-touch-min)] px-4"
      : "h-[var(--size-button-height)] px-6",
    !disabled && "active:scale-[0.985]",
    fullWidth && "w-full",
    variantClasses[variant],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", fullWidth = false, className, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={buttonClasses(variant, fullWidth, Boolean(disabled), className)}
      {...props}
    >
      {children}
    </button>
  );
});

export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

/**
 * 페이지 이동이 목적인 Primary Action용. <button> 안에 <Link>를 중첩하지 않도록
 * Button과 별도 컴포넌트로 둔다(인터랙티브 요소 중첩은 유효하지 않은 HTML이다).
 */
export const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(
  function LinkButton(
    { variant = "primary", fullWidth = false, className, href, children, ...props },
    ref,
  ) {
    return (
      <Link
        ref={ref}
        href={href}
        className={buttonClasses(variant, fullWidth, false, className)}
        {...props}
      >
        {children}
      </Link>
    );
  },
);
