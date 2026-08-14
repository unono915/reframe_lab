"use client";

import { forwardRef, useCallback, useEffect, useRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  /** DESIGN.md §9.2: 약 40dvh까지 자동 확장 후 내부 Scroll. 기본 true. */
  autoGrow?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, error, autoGrow = true, onInput, rows = 6, ...props },
  forwardedRef,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (autoGrow && innerRef.current) resize(innerRef.current);
  }, [autoGrow, resize, props.value]);

  return (
    <textarea
      ref={(node) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      rows={rows}
      onInput={(event) => {
        if (autoGrow) resize(event.currentTarget);
        onInput?.(event);
      }}
      className={cn(
        "w-full rounded-control border border-border bg-paper p-4",
        "text-body font-normal text-ink",
        "placeholder:text-text-tertiary",
        "focus:border-brand",
        "min-h-36",
        autoGrow ? "max-h-[40dvh] resize-none overflow-y-auto" : "resize-y",
        error && "border-danger",
        className,
      )}
      {...props}
    />
  );
});
