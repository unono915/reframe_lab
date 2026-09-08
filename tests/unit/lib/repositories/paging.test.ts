import { describe, expect, it } from "vitest";
import { fetchAllRows, PAGE_SIZE } from "@/lib/repositories/supabase/paging";

/**
 * PostgREST의 조용한 절단에 대한 회귀 테스트.
 *
 * 2026-09-08에 실제로 났던 일: Growth가 1년치 자기 점검 행 2,512개 중 1,000개만
 * 읽고도 아무 오류 없이 지표를 계산했다. 잘려나간 쪽에 "혼자 해보기" 표식이 있어서
 * 완주한 전이 프로브가 **0번으로 집계됐다.** 상한을 넘겼다는 신호는 응답 상태
 * (206)와 `Content-Range` 헤더뿐인데, supabase-js는 그걸 오류로 올리지 않는다.
 *
 * 그래서 "다 읽었는가"를 여기서 못 박는다.
 */

interface Row {
  n: number;
}

/**
 * 서버를 흉내 낸다. `cap`은 한 응답에 담기는 최대 행 수 — 요청한 범위가 더 넓어도
 * 이만큼에서 끊긴다. 실제 PostgREST가 하는 일이 정확히 이것이다.
 */
function makeServer(total: number, cap: number, opts: { count?: boolean } = {}) {
  const calls: Array<[number, number]> = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    const end = Math.min(to + 1, from + cap, total);
    const data: Row[] = [];
    for (let n = from; n < end; n += 1) data.push({ n });
    return {
      data,
      error: null,
      count: opts.count === false ? null : total,
    };
  };
  return { page, calls };
}

describe("fetchAllRows", () => {
  it("상한을 넘는 결과를 끝까지 이어 받는다", async () => {
    const total = PAGE_SIZE * 2 + 512;
    const server = makeServer(total, PAGE_SIZE);

    const rows = await fetchAllRows(server.page);

    expect(rows).toHaveLength(total);
    // 순서까지 그대로여야 한다 — 페이지 경계에서 겹치거나 건너뛰면 여기서 어긋난다.
    expect(rows.map((r) => r.n)).toEqual(Array.from({ length: total }, (_, i) => i));
  });

  it("다 읽으면 더 요청하지 않는다", async () => {
    const server = makeServer(PAGE_SIZE * 2, PAGE_SIZE);

    await fetchAllRows(server.page);

    // 전체 개수를 알고 있으므로 빈 페이지를 확인하러 한 번 더 가지 않는다.
    expect(server.calls).toHaveLength(2);
  });

  it("한 페이지로 끝나면 한 번만 조회한다", async () => {
    const server = makeServer(3, PAGE_SIZE);

    const rows = await fetchAllRows(server.page);

    expect(rows).toHaveLength(3);
    expect(server.calls).toHaveLength(1);
  });

  it("서버 상한이 페이지 크기보다 작아도 빠뜨리지 않는다", async () => {
    // 상한은 서버 설정이라 언제든 내려갈 수 있다. "요청한 만큼 안 왔으니 끝"이라고
    // 판단하면 그 순간 다시 조용히 절단된다 — 개수를 기준으로 삼는 이유다.
    const server = makeServer(2500, 400);

    const rows = await fetchAllRows(server.page);

    expect(rows).toHaveLength(2500);
  });

  it("개수를 못 받으면 빈 페이지가 나올 때까지 읽는다", async () => {
    const server = makeServer(PAGE_SIZE + 7, PAGE_SIZE, { count: false });

    const rows = await fetchAllRows(server.page);

    expect(rows).toHaveLength(PAGE_SIZE + 7);
  });

  it("빈 결과에서 멈춘다", async () => {
    const server = makeServer(0, PAGE_SIZE);

    const rows = await fetchAllRows(server.page);

    expect(rows).toEqual([]);
    expect(server.calls).toHaveLength(1);
  });

  it("오류는 삼키지 않고 던진다", async () => {
    const failing = async () => ({
      data: null,
      error: { message: "권한 없음" },
      count: null,
    });

    await expect(fetchAllRows(failing)).rejects.toMatchObject({ message: "권한 없음" });
  });
});
