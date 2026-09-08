"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { Button, Field, Input, Stack } from "@/components/ui";
import { prefetchAuthClient, requestPasswordReset } from "@/lib/auth/client";
import {
  passwordResetRequestInputSchema,
  type PasswordResetRequestInput,
} from "@/lib/schemas/auth";
import { AuthShell } from "./AuthShell";
import { AuthErrorBanner } from "./AuthErrorBanner";

export function PasswordResetRequestForm() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 인증 SDK는 동적으로 불러온다(lib/auth/client.ts). 사용자가 입력하는 동안 미리
  // 받아두면 제출 시점에는 이미 준비돼 있어, 지연 로딩의 비용이 드러나지 않는다.
  useEffect(() => {
    prefetchAuthClient();
  }, []);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetRequestInput>({
    resolver: zodResolver(passwordResetRequestInputSchema),
  });

  async function onSubmit(values: PasswordResetRequestInput) {
    setFormError(null);
    // DESIGN.md §10.9.3: **서버가 대답했다면** 결과와 무관하게 동일한 안내를 보여준다
    // (계정 존재 노출 방지). 요청이 서버에 닿지도 못한 경우는 다르다 — 그때까지
    // "보냈어요"라고 하면 오지 않을 메일을 기다리게 된다.
    const result = await requestPasswordReset(values.email);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell
      title="비밀번호 재설정"
      footer={
        <Link href="/auth/login" className="text-label font-bold text-brand-strong">
          로그인으로 돌아가기
        </Link>
      }
    >
      {sent ? (
        <p
          role="status"
          className="rounded-control bg-brand-soft px-4 py-3 text-body text-ink"
        >
          입력하신 이메일로 재설정 링크를 보냈어요. 메일함을 확인해주세요.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack gap={5}>
            {formError && <AuthErrorBanner message={formError} />}
            <Field id="reset-email" label="이메일" errorText={errors.email?.message}>
              <Input type="email" autoComplete="email" {...register("email")} />
            </Field>
            <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
              {isSubmitting ? "보내는 중" : "재설정 링크 보내기"}
            </Button>
          </Stack>
        </form>
      )}
    </AuthShell>
  );
}
