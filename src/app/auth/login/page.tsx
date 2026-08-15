"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoginForm } from "@/features/auth/LoginForm";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const verifyError = searchParams.get("verify_error");
  return (
    <LoginForm
      next={next}
      initialError={verifyError ? "링크가 만료됐거나 이미 사용됐어요. 다시 로그인해주세요." : null}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
