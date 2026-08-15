"use client";

import { forwardRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

/**
 * DESIGN.md §9.2 Input 규격. Textarea와 동일한 표면(rounded-control, border-border,
 * bg-paper)을 쓰되 단일 행 높이를 갖는다. Auth Form(§10.9)의 Email·Password에 쓴다.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-[var(--size-button-height)] w-full rounded-control border border-border bg-paper px-4",
        "text-body font-normal text-ink",
        "placeholder:text-text-tertiary",
        "focus:border-brand",
        error && "border-danger",
        className,
      )}
      {...props}
    />
  );
});

export type PasswordInputProps = Omit<InputProps, "type">;

/**
 * DESIGN.md §10.9 공통 Rules: Show/Hide 토글은 오른쪽에 44×44px Touch Target으로 둔다.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-12", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "비밀번호 숨기기" : "비밀번호 표시"}
          aria-pressed={visible}
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-center",
            "h-[var(--size-touch-min)] w-[var(--size-touch-min)]",
            "text-text-secondary hover:text-ink",
          )}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    );
  },
);

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M2.5 2.5l15 15M8.3 8.4a2.5 2.5 0 0 0 3.4 3.4M6 5.1C3.6 6.3 1.5 10 1.5 10s3 6 8.5 6c1.4 0 2.7-.4 3.8-1M15.6 14.2c1.7-1.3 2.9-3.3 2.9-4.2 0 0-3-6-8.5-6-.7 0-1.4.1-2 .3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
