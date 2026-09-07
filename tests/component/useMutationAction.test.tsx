import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMutationAction } from "@/features/training/useMutationAction";
import { UserFacingError } from "@/lib/fetch-json";

/**
 * 이 훅이 지키는 것은 하나다: **보조 동작이 실패했을 때 사용자가 그 사실을 알고,
 * 지워진 입력이 되돌아온다.** 훈련 화면들은 "입력창을 먼저 비우고 저장을 기다리는"
 * 순서를 쓰기 때문에, 실패를 조용히 넘기면 사용자가 쓴 문장이 그대로 사라진다
 * (CLAUDE.md 원칙 7).
 */
describe("useMutationAction", () => {
  it("성공하면 true를 주고 오류를 남기지 않는다", async () => {
    const { result } = renderHook(() => useMutationAction());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.run(() => Promise.resolve("saved"));
    });

    expect(ok).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.pending).toBe(false);
  });

  it("실패하면 false를 주고, 지운 입력을 되돌리는 rollback을 부른다", async () => {
    const { result } = renderHook(() => useMutationAction());
    const rollback = vi.fn();

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.run(
        () => Promise.reject(new UserFacingError("저장하지 못했어요.")),
        rollback,
      );
    });

    expect(ok).toBe(false);
    expect(rollback).toHaveBeenCalledOnce();
    // 우리가 쓴 한국어 문장은 그대로 전달된다.
    expect(result.current.error).toBe("저장하지 못했어요.");
  });

  it("브라우저가 던진 영어 예외는 한국어 문장으로 바꿔 보여준다", async () => {
    const { result } = renderHook(() => useMutationAction());

    await act(async () => {
      // 네트워크 단절 시 fetch가 던지는 형태.
      await result.current.run(() => Promise.reject(new TypeError("Failed to fetch")));
    });

    expect(result.current.error).not.toContain("Failed to fetch");
    expect(result.current.error).toContain("인터넷 연결");
  });

  it("이전 실패 메시지는 다음 시도를 시작할 때 지운다", async () => {
    const { result } = renderHook(() => useMutationAction());

    await act(async () => {
      await result.current.run(() => Promise.reject(new UserFacingError("첫 실패")));
    });
    expect(result.current.error).toBe("첫 실패");

    await act(async () => {
      await result.current.run(() => Promise.resolve());
    });
    expect(result.current.error).toBeNull();
  });

  it("연타해도 한 번만 보낸다 — 같은 항목이 두 번 저장되지 않는다", async () => {
    const { result } = renderHook(() => useMutationAction());
    let resolveTask: (() => void) | undefined;
    const task = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveTask = resolve;
        }),
    );

    await act(async () => {
      const first = result.current.run(task);
      const second = result.current.run(task);
      resolveTask?.();
      await Promise.all([first, second]);
    });

    expect(task).toHaveBeenCalledOnce();
  });
});
