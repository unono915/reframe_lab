"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoginForm } from "@/features/auth/LoginForm";
import { safeNextPath } from "@/lib/auth/next-path";

/**
 * 인증 링크가 실패했을 때의 문구. **"끝났으니 로그인만 하면 된다"와 "다시 받아야
 * 한다"는 사용자가 할 일이 정반대**라 한 문구로 묶으면 안 된다 — 이미 인증이 끝난
 * 사람에게 "만료됐다"고 말하면 링크를 다시 받으려고 계속 헤매게 된다
 * (`src/app/auth/confirm/route.ts` 주석 참고).
 */
function verifyMessage(reason: string | null): string | null {
  if (!reason) return null;
  if (reason === "signin") return "이메일 인증은 끝났어요. 이제 로그인해주세요.";
  return "링크가 만료됐거나 이미 사용됐어요. 다시 로그인해주세요.";
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  // URL에서 온 값을 그대로 `router.push`에 넘기면 열린 리다이렉트가 된다 —
  // 사용자는 진짜 도메인에서 진짜 비밀번호를 넣은 뒤 남의 사이트로 넘어간다.
  const next = safeNextPath(searchParams.get("next"));
  const verifyError = searchParams.get("verify_error");
  return <LoginForm next={next} initialError={verifyMessage(verifyError)} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
