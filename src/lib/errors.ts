import { NextResponse } from "next/server";

/**
 * API 오류 코드 단일 소스. Route Handler는 항상 이 형태로 오류를 반환한다 —
 * 클라이언트가 errorCode로 분기하고 message는 그대로 사용자에게 보여준다.
 */
export type ApiErrorCode =
  | "unauthorized"
  | "not_found"
  | "validation_error"
  | "wrong_state_version"
  | "requirement_not_met"
  | "invalid_transition"
  | "internal_error";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  not_found: 404,
  validation_error: 400,
  wrong_state_version: 409,
  requirement_not_met: 422,
  invalid_transition: 409,
  internal_error: 500,
};

export interface ApiErrorBody {
  errorCode: ApiErrorCode;
  message: string;
}

const DEFAULT_MESSAGE: Record<ApiErrorCode, string> = {
  unauthorized: "로그인이 필요해요.",
  not_found: "요청한 세션을 찾을 수 없어요.",
  validation_error: "입력값을 확인해주세요.",
  wrong_state_version: "다른 곳에서 이미 진행된 내용이 있어요. 최신 상태로 다시 시도해주세요.",
  requirement_not_met: "이 단계를 넘어가기 위한 조건이 아직 충족되지 않았어요.",
  invalid_transition: "지금은 이 동작을 할 수 없는 상태예요.",
  internal_error: "서버에 저장하지 못했어요. 이 기기의 초안은 유지하고 있어요.",
};

export function apiError(code: ApiErrorCode, message?: string, extra?: Record<string, unknown>) {
  const body: ApiErrorBody & Record<string, unknown> = {
    errorCode: code,
    message: message ?? DEFAULT_MESSAGE[code],
    ...extra,
  };
  return NextResponse.json(body, { status: STATUS_BY_CODE[code] });
}
