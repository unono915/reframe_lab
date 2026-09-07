import { cloneElement, isValidElement } from "react";
import type { ReactElement } from "react";
import { cn } from "./cn";

/**
 * 상한의 몇 %부터 글자 수를 보여줄지. DESIGN.md §579는 "제한에 가까워질 때만"
 * 노출하라고 정한다 — 처음부터 세고 있으면 쓰는 사람이 분량을 의식하게 되고,
 * 이 앱은 생각을 적는 곳이라 그게 특히 나쁘다.
 */
const COUNTER_VISIBLE_RATIO = 0.85;

export interface FieldProps {
  id: string;
  label: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  /**
   * 글자 수 안내. `max`는 반드시 스키마의 상한과 같은 값이어야 한다
   * (`lib/schemas/stage-input.ts`의 `INPUT_LIMITS`) — 숫자를 화면에 따로 적으면
   * 스키마를 고칠 때 조용히 어긋나고, "쓸 수 있다고 해놓고 저장할 때 거부하는"
   * 상태가 된다.
   */
  counter?: { current: number; max: number };
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
  counter,
  children,
}: FieldProps) {
  const overLimit = counter ? counter.current > counter.max : false;
  const showCounter = counter
    ? overLimit || counter.current >= counter.max * COUNTER_VISIBLE_RATIO
    : false;

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
      {showCounter && counter && (
        // 넘긴 뒤에야 알려주면 이미 쓴 문장을 어디서 줄여야 할지 모른다. 넘긴
        // 순간에는 색으로도 알린다 — 색만으로 알리지는 않는다(숫자가 함께 있다).
        <p
          aria-live="polite"
          className={cn(
            "text-caption text-right tabular-nums",
            overLimit ? "font-bold text-danger" : "text-text-secondary",
          )}
        >
          {counter.current} / {counter.max}자
        </p>
      )}
    </div>
  );
}
