"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Input, PasswordInput, Stack } from "@/components/ui";
import { signUpWithEmail } from "@/lib/auth/client";
import { signupInputSchema, type SignupInput } from "@/lib/schemas/auth";
import { AuthShell } from "./AuthShell";
import { AuthErrorBanner } from "./AuthErrorBanner";

export function SignupForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupInputSchema) });

  async function onSubmit(values: SignupInput) {
    setFormError(null);
    const result = await signUpWithEmail(values.email, values.password);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    router.push(`/auth/verify-email?email=${encodeURIComponent(values.email)}`);
  }

  return (
    <AuthShell
      title="회원가입"
      footer={
        <p className="text-label text-text-secondary">
          이미 계정이 있으신가요?{" "}
          <Link href="/auth/login" className="font-bold text-brand-strong">
            로그인
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap={5}>
          {formError && <AuthErrorBanner message={formError} />}
          <Field id="signup-email" label="이메일" errorText={errors.email?.message}>
            <Input type="email" autoComplete="email" {...register("email")} />
          </Field>
          <Field
            id="signup-password"
            label="비밀번호"
            helperText="8자 이상으로 만들어주세요."
            errorText={errors.password?.message}
          >
            <PasswordInput autoComplete="new-password" {...register("password")} />
          </Field>
          <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
            {isSubmitting ? "가입 중" : "회원가입"}
          </Button>
        </Stack>
      </form>
    </AuthShell>
  );
}
