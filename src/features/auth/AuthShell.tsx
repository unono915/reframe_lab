import type { ReactNode } from "react";
import { Card } from "@/components/ui";

interface AuthShellProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * DESIGN.md §10.9 Layout(공통 골격) + Rules. Auth는 필수 관문이라 Onboarding으로
 * 돌아가는 진입점을 두지 않는다. Content Max Width 400px — Training의 640px보다 좁게.
 */
export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center px-5">
      <div className="flex w-full max-w-[400px] flex-col gap-8">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-label font-bold text-brand-strong">다시봄</p>
        </div>
        <Card variant="paper" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-heading-2 font-bold text-ink">{title}</h1>
            {description && <p className="text-body text-text-secondary">{description}</p>}
          </div>
          {children}
        </Card>
        {footer && <div className="text-center">{footer}</div>}
      </div>
    </main>
  );
}
