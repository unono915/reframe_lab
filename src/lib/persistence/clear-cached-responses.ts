/**
 * 로그아웃할 때 Service Worker가 들고 있던 응답 캐시를 지운다.
 *
 * 왜 필요한가 — Serwist의 기본 런타임 캐싱은 같은 출처의 `GET /api/*` 응답을
 * `NetworkFirst`로 24시간 보관한다(`@serwist/turbopack`의 defaultCache). 오프라인에서
 * 기록을 읽을 수 있는 것도 그 덕이지만, 그 캐시에 담기는 것은 **그 사람이 쓴 글
 * 전부**다 — 관찰한 장면, 문제 정의, 코치 피드백.
 *
 * 로그아웃은 세션 쿠키만 지우고 이 캐시는 그대로 뒀다. 한 기기를 나눠 쓰는 상황에서
 * 다음 사람이 로그인한 뒤 연결이 끊기면, `NetworkFirst`가 네트워크 실패를 캐시로
 * 메우면서 **앞 사람의 기록을 보여줄 수 있었다.** 로그인 화면 뒤에 있어야 할 내용이
 * 로그인과 무관하게 남아 있던 셈이다.
 *
 * 캐시 이름을 골라 지우지 않고 전부 지운다. 이름은 라이브러리가 정하는 값이라
 * 버전이 바뀌면 조용히 어긋나고, 그때 남는 것이 하필 개인 기록이다. 앱 셸은 다음
 * 방문에 다시 채워지고, 로그아웃은 방금 네트워크 요청이 성공한 시점이므로 다시
 * 받을 수 있는 상태다.
 *
 * **로컬 초안(IndexedDB)은 지우지 않는다.** 그쪽은 세션 id로만 찾게 되어 있어 다른
 * 사람의 화면에 뜨지 않고, 무엇보다 아직 서버에 확정되지 않은 사용자의 글이다 —
 * 실수로 로그아웃한 사람의 입력을 우리가 지우는 것은 원칙 7에 정면으로 어긋난다.
 */
export async function clearCachedResponses(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch (error) {
    // 사생활 보호 모드처럼 Cache API 접근 자체가 막힌 환경이 있다. 그런 곳에는
    // 애초에 남는 것도 없으므로, 로그아웃을 실패로 만들지 않고 넘어간다.
    console.error("[pwa] 응답 캐시 정리 실패", error);
  }
}
