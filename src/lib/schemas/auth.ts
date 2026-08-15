import { z } from "zod";

/**
 * Auth Form 검증 스키마. Supabase Auth 자체가 최종 검증을 하지만(예: 이메일 중복),
 * 여기서는 사용자에게 즉시 인라인 오류를 보여주기 위한 "모양" 검증만 한다
 * (DESIGN.md §10.9 Rules: 오류는 §11 UI States의 Validation Treatment를 따른다).
 */

const emailSchema = z.string().trim().min(1, "이메일을 입력해주세요.").email("올바른 이메일 형식이 아니에요.");

// DESIGN.md §10.9.2: "최소 길이 등 규칙을 Helper Text로 상시 노출" — Supabase 기본 정책(8자 이상)과 맞춘다.
const newPasswordSchema = z
  .string()
  .min(8, "비밀번호는 8자 이상이어야 해요.")
  .max(72, "비밀번호는 72자를 넘을 수 없어요.");

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const signupInputSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
});
export type SignupInput = z.infer<typeof signupInputSchema>;

export const passwordResetRequestInputSchema = z.object({
  email: emailSchema,
});
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestInputSchema>;

export const passwordResetCompleteInputSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, "비밀번호를 다시 입력해주세요."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 서로 달라요.",
    path: ["confirmPassword"],
  });
export type PasswordResetCompleteInput = z.infer<typeof passwordResetCompleteInputSchema>;
