"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Input, PasswordInput, Stack } from "@/components/ui";
import { prefetchAuthClient, signInWithEmail } from "@/lib/auth/client";
import { loginInputSchema, type LoginInput } from "@/lib/schemas/auth";
import { AuthShell } from "./AuthShell";
import { AuthErrorBanner } from "./AuthErrorBanner";

export function LoginForm({
  next = "/",
  initialError,
}: {
  next?: string;
  initialError?: string | null;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(initialError ?? null);

  // 인증 SDK는 동적으로 불러온다(lib/auth/client.ts). 사용자가 입력하는 동안 미리
  // 받아두면 제출 시점에는 이미 준비돼 있어, 지연 로딩의 비용이 드러나지 않는다.
  useEffect(() => {
    prefetchAuthClient();
  }, []);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginInputSchema) });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    const result = await signInWithEmail(values.email, values.password);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <AuthShell
      title="로그인"
      footer={
        <Stack gap={2}>
          <Link
            href="/auth/reset-password"
            className="text-label font-bold text-brand-strong"
          >
            비밀번호를 잊으셨나요?
          </Link>
          <p className="text-label text-text-secondary">
            계정이 없으신가요?{" "}
            <Link href="/auth/signup" className="font-bold text-brand-strong">
              회원가입
            </Link>
          </p>
        </Stack>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap={5}>
          {formError && <AuthErrorBanner message={formError} />}
          <Field id="login-email" label="이메일" errorText={errors.email?.message}>
            <Input type="email" autoComplete="email" {...register("email")} />
          </Field>
          <Field
            id="login-password"
            label="비밀번호"
            errorText={errors.password?.message}
          >
            <PasswordInput autoComplete="current-password" {...register("password")} />
          </Field>
          <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
            {isSubmitting ? "로그인 중" : "로그인"}
          </Button>
        </Stack>
      </form>
    </AuthShell>
  );
}
