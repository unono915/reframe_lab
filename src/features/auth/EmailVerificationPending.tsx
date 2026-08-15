"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Stack } from "@/components/ui";
import { hasActiveSession, resendVerificationEmail } from "@/lib/auth/client";
import { AuthShell } from "./AuthShell";
import { AuthErrorBanner } from "./AuthErrorBanner";

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * DESIGN.md §10.9.5. "인증 완료 후 앱으로 돌아오면 자동으로 Home으로 이동한다" —
 * 이메일 Link를 다른 탭/Safari에서 눌러 인증을 마치고 이 탭으로 돌아왔을 때를
 * 위해 포커스 복귀 시 세션을 다시 확인한다. Link를 직접 눌러 같은 탭에서 열리는
 * 경우는 `app/auth/confirm/route.ts`가 처리한다.
 */
export function EmailVerificationPending({ email }: { email: string }) {
  const router = useRouter();
  const [cooldown, setCooldown] = useState(0);
  const [resendError, setResendError] = useState<string | null>(null);
  const [justResent, setJustResent] = useState(false);

  useEffect(() => {
    async function checkSession() {
      if (await hasActiveSession()) {
        router.push("/");
        router.refresh();
      }
    }
    function onVisible() {
      if (document.visibilityState === "visible") void checkSession();
    }
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleResend() {
    setResendError(null);
    setJustResent(false);
    const result = await resendVerificationEmail(email);
    if (!result.ok) {
      setResendError(result.message);
      return;
    }
    setJustResent(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <AuthShell title="이메일을 확인해주세요">
      <Stack gap={5}>
        <EnvelopeGraphic />
        <p className="text-body text-ink">
          <strong>{email}</strong>로 보내드린 링크를 눌러 인증을 완료해주세요.
        </p>
        {resendError && <AuthErrorBanner message={resendError} />}
        {justResent && cooldown > 0 && (
          <p role="status" className="text-label text-text-secondary">
            인증 메일을 다시 보냈어요.
          </p>
        )}
        <Stack gap={2}>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={cooldown > 0}
            onClick={handleResend}
          >
            인증 메일 다시 보내기
          </Button>
          {cooldown > 0 && (
            <p className="text-center text-caption text-text-tertiary">
              {cooldown}초 후 다시 보낼 수 있어요.
            </p>
          )}
        </Stack>
      </Stack>
    </AuthShell>
  );
}

function EnvelopeGraphic() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className="mx-auto text-brand"
    >
      <rect x="6" y="14" width="52" height="38" rx="8" stroke="currentColor" strokeWidth="3" />
      <path
        d="M8 18l24 18 24-18"
        stroke="var(--color-brand-strong)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
