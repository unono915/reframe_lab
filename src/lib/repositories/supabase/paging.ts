/**
 * PostgREST는 한 응답에 담는 행 수에 상한이 있다(이 프로젝트는 1000). 넘어가면
 * `206 Partial Content`로 **앞부분만** 오는데, supabase-js는 이걸 오류로 보지 않는다 —
 * `error`는 null이고 `data`만 짧다. 호출부에서는 구분할 방법이 없다.
 *
 * 실제로 이것 때문에 Growth가 조용히 틀린 값을 보여주고 있었다. 1년치(365세션)의
 * 자기 점검 행이 2,512개까지 늘어난 계정에서 1,000개만 읽혔고, 잘려나간 쪽에 있던
 * "혼자 해보기" 표식이 사라져 **완주한 전이 프로브가 0번으로 집계됐다**. 눈에 보이는
 * 오류는 없었다. 화면은 그냥 "혼자 해낸 기록" 카드를 안 그렸을 뿐이다.
 *
 * 더 위험한 것은 같은 함수가 "생각이 달라진 지점"의 원천도 같은 방식으로 읽는다는
 * 점이다 — 절단된 표본으로 계산한 추세를 사용자에게 변화로 말하게 된다. 이 앱에서
 * 지표는 장식이 아니라 주장이라, 덜 읽고 조용히 넘어가는 것이 최악의 실패다.
 *
 * 그래서 상한을 넘겨받을 수 있는 조회는 전부 이 함수를 거친다. `count: "exact"`로
 * 전체 개수를 함께 받아 다 읽을 때까지 이어 받고, 개수를 못 받은 경우에도 빈 페이지가
 * 나오기 전까지는 멈추지 않는다(서버 상한이 페이지 크기보다 작아도 안전하도록).
 */
export const PAGE_SIZE = 1000;

export interface PagedResult<Row> {
  data: Row[] | null;
  error: { message: string } | null;
  count: number | null;
}

export async function fetchAllRows<Row>(
  page: (from: number, to: number) => PromiseLike<PagedResult<Row>>,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (;;) {
    /*
      다음 범위의 시작은 **지금까지 실제로 받은 행 수**다. 페이지 크기만큼 건너뛰면
      안 된다 — 서버 상한이 페이지 크기보다 작을 때(설정은 언제든 내려갈 수 있다)
      받지도 않은 구간을 뛰어넘어 조용히 빠뜨리게 된다. 이 함수의 첫 판이 정확히
      그렇게 틀렸고, 단위 테스트에서 잡혔다.
    */
    const { data, error, count } = await page(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length === 0) break;
    if (count !== null && rows.length >= count) break;
  }
  return rows;
}
