"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EmailVerificationPending } from "@/features/auth/EmailVerificationPending";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  return <EmailVerificationPending email={email} />;
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
