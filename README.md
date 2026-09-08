# 다시봄 (Reframe Lab)

> 일상의 장면을 스스로 관찰하고 질문하며 문제를 **다시 정의**하도록 돕는
> 하루 5~10분 AI 사고 코칭 PWA. 한국어, iPhone 홈 화면 설치형이 1차 대상입니다.

AI가 답을 만들어 주는 앱이 아닙니다. 방향이 반대입니다 — **사용자가 먼저 쓰고,**
AI는 한 번에 하나의 질문으로 사고를 밀어줍니다. 최종 산출물은 '완벽한 문제 정의'가
아니라 지금 근거에서 가장 타당한 문제 정의입니다.

훈련 흐름: 관찰 → 구분(사실·해석·가정) → 질문 → 탐색 → 재정의 → 정의 → 돌아보기

## 상태

7단계 훈련, 기록·성장 화면, 인증, AI 코치(Upstage `solar-pro4`), PWA 셸까지 동작합니다.
Vercel에 배포되어 있고 데이터는 Supabase(RLS 기본 거부)에 저장됩니다.

남은 것은 대부분 사람이 결정해야 하는 항목입니다 — 개인정보·AI 전송 안내 문구,
템플릿 문구 검수, iPhone 실기 테스트. 자세한 진행 상태는 `AGENTS.md`에 있습니다.

## 로컬 실행

```bash
npm ci
cp .env.example .env.local   # 값을 채운 뒤
npm run dev
```

`.env.local`에 필요한 값은 `.env.example`에 목록이 있습니다. Supabase의 두 값
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)이 없으면 **빌드가 일부러
실패합니다** — 값 없이 빌드하면 `undefined`가 코드에 인라인된 채 배포가 나가고, 그
배포는 전 경로가 500으로 죽기 때문입니다(`src/lib/supabase/env.ts` 주석 참고).

`UPSTAGE_API_KEY`가 없으면 AI 코치는 규칙 기반 Mock으로 동작합니다. 훈련 완주에는
지장이 없습니다 — "AI 실패가 세션 실패가 되지 않는다"가 이 앱의 개발 원칙 중 하나입니다.

## 검사

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
```

브라우저 테스트는 실제 Supabase 프로젝트를 대상으로 돕니다. `.env.local`에
`E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`가 있어야 하고, 없으면 로그인이 필요한 항목을
건너뜁니다(건너뛴다는 사실은 출력에 남습니다).

```bash
npm run test:e2e
```

`tests/integration/`의 RLS·RPC 검사는 `SUPABASE_DB_URL`(Postgres 직접 접속 문자열)이
있을 때만 실행됩니다.

## 저장소 구조

| 경로 | 내용 |
| --- | --- |
| `src/domain/` | 순수 TypeScript. 상태 전환·완료 조건·지표 계산. React·DB·AI SDK를 import하지 않습니다 |
| `src/lib/ai/` | 프롬프트, 출력 스키마, Guardrail, 제공자 Adapter |
| `src/lib/repositories/` | 저장소 경계(인메모리/Supabase 두 구현) |
| `src/app/api/` | Route Handler. 인증·멱등성·오류 코드를 명시적으로 다룹니다 |
| `src/features/` | 화면 단위 컴포넌트 |
| `supabase/migrations/` | 스키마·RLS·RPC |

`domain/`이 아무것도 import하지 않는 것과, 화면이 저장소·AI를 직접 만지지 않는 것은
ESLint 규칙으로 강제됩니다.

## 문서

제품 기획서(PRD), 디자인 스펙, 개발 계획은 저장소에 포함하지 않고 로컬에서만
관리합니다. 예외는 **`AGENTS.md`** 하나로, 에이전트 작업의 시간순 로그입니다 —
무엇을 왜 고쳤는지, 그리고 **고치지 않기로 한 것은 왜인지**가 거기 있습니다.

배포 절차는 `docs/deployment.md`에 있습니다.
