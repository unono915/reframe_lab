import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCachedResponses } from "@/lib/persistence/clear-cached-responses";

/**
 * 로그아웃 뒤에 개인 기록이 기기에 남지 않는지 확인한다.
 *
 * Service Worker의 기본 런타임 캐싱은 `GET /api/*` 응답을 24시간 보관한다. 담기는
 * 것은 그 사람이 쓴 글 전부다 — 관찰한 장면, 문제 정의, 코치 피드백. 로그아웃이
 * 세션 쿠키만 지우고 이 캐시를 남겨두면, 한 기기를 나눠 쓰는 다음 사람이 로그인한
 * 뒤 연결이 끊겼을 때 `NetworkFirst`가 네트워크 실패를 캐시로 메우면서 앞 사람의
 * 기록을 보여줄 수 있다.
 */
const originalCaches = globalThis.caches;

afterEach(() => {
  if (originalCaches === undefined) {
    Reflect.deleteProperty(globalThis, "caches");
  } else {
    Object.defineProperty(globalThis, "caches", {
      value: originalCaches,
      configurable: true,
      writable: true,
    });
  }
});

function installCaches(names: string[]) {
  const deleted: string[] = [];
  const fake = {
    keys: vi.fn(async () => names),
    delete: vi.fn(async (key: string) => {
      deleted.push(key);
      return true;
    }),
  };
  Object.defineProperty(globalThis, "caches", {
    value: fake,
    configurable: true,
    writable: true,
  });
  return { fake, deleted };
}

describe("clearCachedResponses", () => {
  it("캐시를 하나도 남기지 않는다", async () => {
    // 이름을 골라 지우지 않는 이유는 그 이름이 라이브러리가 정하는 값이기 때문이다 —
    // 버전이 바뀌어 이름이 달라지면 조용히 어긋나고, 그때 남는 것이 개인 기록이다.
    const { deleted } = installCaches([
      "apis",
      "serwist-precache-v2",
      "pages-rsc",
      "static-image-assets",
    ]);

    await clearCachedResponses();

    expect(deleted).toEqual([
      "apis",
      "serwist-precache-v2",
      "pages-rsc",
      "static-image-assets",
    ]);
  });

  it("지울 것이 없으면 아무 일도 하지 않는다", async () => {
    const { fake } = installCaches([]);

    await clearCachedResponses();

    expect(fake.delete).not.toHaveBeenCalled();
  });

  it("Cache API가 없는 환경에서도 실패하지 않는다", async () => {
    Reflect.deleteProperty(globalThis, "caches");

    await expect(clearCachedResponses()).resolves.toBeUndefined();
  });

  it("캐시 접근이 막혀 있어도 로그아웃을 실패로 만들지 않는다", async () => {
    // 사생활 보호 모드처럼 Cache API 자체가 막힌 환경이 있다. 그런 곳에는 애초에
    // 남는 것도 없으므로, 여기서 던지면 멀쩡한 로그아웃이 실패로 보인다.
    Object.defineProperty(globalThis, "caches", {
      value: {
        keys: vi.fn(async () => {
          throw new Error("접근 거부");
        }),
      },
      configurable: true,
      writable: true,
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(clearCachedResponses()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
