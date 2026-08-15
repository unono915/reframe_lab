/**
 * DESIGN.md §10.9 Rules / §11 UI States: Validation·Save Error는 Danger-soft
 * Inline Banner로 보여준다 (배경 있는 박스, Toast 아님 — 화면에 안정적으로 남는다).
 */
export function AuthErrorBanner({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-control bg-danger-bg px-4 py-3 text-label font-bold text-danger">
      {message}
    </p>
  );
}
