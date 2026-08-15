"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button, Field, PasswordInput, Stack } from "@/components/ui";
import { updatePassword } from "@/lib/auth/client";
import {
  passwordResetCompleteInputSchema,
  type PasswordResetCompleteInput,
} from "@/lib/schemas/auth";
import { AuthShell } from "./AuthShell";
import { AuthErrorBanner } from "./AuthErrorBanner";

/**
 * 이메일 재설정 Link로 진입 — Supabase가 이미 임시 복구 세션을 심어둔 상태다.
 * 새 비밀번호 저장에 성공하면 그 세션이 곧 정식 세션이므로 로그인 화면을 다시
 * 거치지 않고 바로 Home으로 보낸다(DESIGN.md §10.9.4의 두 선택지 중 이 쪽을 택함).
 */
export function PasswordResetCompleteForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetCompleteInput>({
    resolver: zodResolver(passwordResetCompleteInputSchema),
  });

  async function onSubmit(values: PasswordResetCompleteInput) {
    setFormError(null);
    const result = await updatePassword(values.password);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <AuthShell title="새 비밀번호 설정">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap={5}>
          {formError && <AuthErrorBanner message={formError} />}
          <Field
            id="reset-password"
            label="새 비밀번호"
            helperText="8자 이상으로 만들어주세요."
            errorText={errors.password?.message}
          >
            <PasswordInput autoComplete="new-password" {...register("password")} />
          </Field>
          <Field
            id="reset-password-confirm"
            label="새 비밀번호 확인"
            errorText={errors.confirmPassword?.message}
          >
            <PasswordInput autoComplete="new-password" {...register("confirmPassword")} />
          </Field>
          <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
            {isSubmitting ? "변경 중" : "비밀번호 변경하기"}
          </Button>
        </Stack>
      </form>
    </AuthShell>
  );
}
