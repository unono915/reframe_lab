"use client";

/**
 * 버튼 바로 아래에 붙는 실패 안내. 훈련 화면이 이미 쓰고 있는 표현
 * (`role="alert"` + `text-caption font-bold text-danger`)을 한 곳으로 모은 것이라
 * 새 시각 규칙을 만들지 않는다 — DESIGN.md §15.2의 오류 표현을 그대로 따른다.
 *
 * `message`가 없으면 아무것도 렌더하지 않으므로 호출부에서 조건 분기를 쓰지 않아도 된다.
 */
export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-caption font-bold text-danger">
      {message}
    </p>
  );
}
