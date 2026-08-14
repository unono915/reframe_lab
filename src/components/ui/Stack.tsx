import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/** DESIGN.md §6.1 space-1..space-16 스텝만 허용한다. 임의 gap 값을 만들지 않는다. */
export type SpaceStep = 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;

const gapClasses: Record<SpaceStep, string> = {
  1: "gap-1",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  5: "gap-5",
  6: "gap-6",
  8: "gap-8",
  10: "gap-10",
  12: "gap-12",
  16: "gap-16",
};

export interface StackProps extends Omit<HTMLAttributes<HTMLElement>, "className"> {
  direction?: "row" | "column";
  gap?: SpaceStep;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

const alignClasses = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

const justifyClasses = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
};

export function Stack({
  direction = "column",
  gap = 4,
  align,
  justify,
  as: Component = "div",
  className,
  children,
  ...props
}: StackProps) {
  return (
    <Component
      className={cn(
        "flex",
        direction === "row" ? "flex-row" : "flex-col",
        gapClasses[gap],
        align && alignClasses[align],
        justify && justifyClasses[justify],
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
