"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { Button, Field, Input, Stack } from "@/components/ui";
import { requestPasswordReset } from "@/lib/auth/client";
import {
  passwordResetRequestInputSchema,
  type PasswordResetRequestInput,
} from "@/lib/schemas/auth";
import { AuthShell } from "./AuthShell";

export function PasswordResetRequestForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetRequestInput>({
    resolver: zodResolver(passwordResetRequestInputSchema),
  });

  async function onSubmit(values: PasswordResetRequestInput) {
    // DESIGN.md §10.9.3: 성공 여부와 무관하게 동일한 안내를 보여준다(계정 존재 노출 방지).
    await requestPasswordReset(values.email);
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
        <p role="status" className="rounded-control bg-brand-soft px-4 py-3 text-body text-ink">
          입력하신 이메일로 재설정 링크를 보냈어요. 메일함을 확인해주세요.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack gap={5}>
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
