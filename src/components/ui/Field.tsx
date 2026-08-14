import { cloneElement, isValidElement } from "react";
import type { ReactElement } from "react";
import { cn } from "./cn";

export interface FieldProps {
  id: string;
  label: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  children: ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;
}

/**
 * DESIGN.md §9.2 Input Rules: Label은 Input 위에 항상 표시, 오류는 해당 Field와 연결한다 (§14.3).
 * 자식 Control(Textarea 등)에 id·aria-describedby·aria-invalid를 주입해 접근성 연결을 강제한다.
 */
export function Field({
  id,
  label,
  helperText,
  errorText,
  required,
  children,
}: FieldProps) {
  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = errorText ? `${id}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": Boolean(errorText),
      })
    : children;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label font-bold text-ink">
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger">
            {" "}
            *
          </span>
        )}
      </label>
      {control}
      {helperText && !errorText && (
        <p id={helperId} className="text-caption text-text-secondary">
          {helperText}
        </p>
      )}
      {errorText && (
        <p id={errorId} role="alert" className={cn("text-caption font-bold text-danger")}>
          {errorText}
        </p>
      )}
    </div>
  );
}
