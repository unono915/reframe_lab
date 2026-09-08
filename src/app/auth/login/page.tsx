"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoginForm } from "@/features/auth/LoginForm";
import { safeNextPath } from "@/lib/auth/next-path";

function LoginPageContent() {
  const searchParams = useSearchParams();
  // URL에서 온 값을 그대로 `router.push`에 넘기면 열린 리다이렉트가 된다 —
  // 사용자는 진짜 도메인에서 진짜 비밀번호를 넣은 뒤 남의 사이트로 넘어간다.
  const next = safeNextPath(searchParams.get("next"));
  const verifyError = searchParams.get("verify_error");
  return (
    <LoginForm
      next={next}
      initialError={
        verifyError ? "링크가 만료됐거나 이미 사용됐어요. 다시 로그인해주세요." : null
      }
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
