# 배포 절차 (§14-E)

> 2026-08-16 기준. 앱은 배포 준비가 끝난 상태다 — 프로덕션 빌드·오프라인 동작·
> Service Worker까지 로컬에서 검증했다. 남은 것은 아래 절차뿐이다.

## 현재 상태

- GitHub 저장소: `unono915/reframe_lab` (main 브랜치가 최신)
- Vercel 프로젝트: **`reframe-lab` 이름으로 생성은 되었으나 조회·배포가 막혀 있다**
- 프로덕션 빌드: 통과 (`npm run build`)
- 배포된 사이트: **없음**

### 자동 배포가 막힌 이유

Claude가 Vercel MCP로 배포를 시도했을 때 아래 응답을 받았다.

| 시도 | 결과 |
|---|---|
| 프로젝트 생성 + 배포 | `403 You don't have permission to create a Production Deployment for this project` |
| 프로젝트 생성만 | `409 Project "reframe-lab" already exists` |
| 프로젝트 조회 (`get_project`, `list_projects`) | `404` / 빈 목록 |

쓰기는 통과하는데 읽기와 배포가 막히는 **권한 스코프 불일치**다. 연결된 Vercel
토큰이 해당 팀에서 배포를 만들 권한이 없거나, 프로젝트가 조회 대상과 다른 스코프
(개인 계정 등)에 생성된 것으로 보인다. 계정 소유자만 해결할 수 있어 아래는 직접
수행해야 한다.

---

## 1. Vercel 프로젝트 확인 · 배포

1. https://vercel.com/dashboard 에서 `reframe-lab` 프로젝트가 보이는지 확인한다.
   - **보이면** → 2번(환경변수)으로 간다.
   - **안 보이면** → 이미 만들어진 프로젝트가 다른 스코프에 있다. 그 프로젝트를
     지우거나 다른 이름을 쓰고, `Add New… → Project → Import Git Repository`에서
     `unono915/reframe_lab`을 import한다. Framework는 Next.js로 자동 감지된다.
2. Import 시 **Deploy를 바로 누르지 말고** 환경변수부터 넣는다(2번). 없이 배포하면
   빌드는 통과하지만 실행 시 Supabase 연결이 끊긴 채로 뜬다.

## 2. 환경변수 (필수 2개)

Project Settings → Environment Variables. **Production·Preview 양쪽 모두** 지정한다.

| 이름 | 값 | 비고 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dqzwujmaaeczmylwvyip.supabase.co` | 공개 가능 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 대시보드 → Project Settings → API → `anon` / `publishable` key | RLS 뒤에서만 동작하는 공개 키 |

> Service Role Key는 **절대 넣지 않는다.** 이 앱의 Route Handler는 전부 사용자
> 세션(RLS) 경계로만 동작해 필요가 없다 (CLAUDE.md §3 원칙 9).
>
> `NEXT_PUBLIC_` 두 개는 빌드 시점에 클라이언트 번들로 인라인된다 — **값을 바꾸면
> 반드시 재배포해야 반영된다.**

## 3. Supabase Auth Redirect URL 등록 (놓치기 쉬움)

배포 도메인이 생기면 Supabase에 알려줘야 회원가입 확인 메일과 비밀번호 재설정
링크가 동작한다. 앱 코드는 실행 도메인을 자동으로 따라가지만(`window.location.origin`),
**Supabase가 허용 목록에 없는 redirect를 거부한다.**

Supabase 대시보드 → Authentication → URL Configuration:

- **Site URL**: 배포 도메인 (예: `https://reframe-lab.vercel.app`)
- **Redirect URLs**에 아래를 추가한다.
  ```
  https://reframe-lab.vercel.app/**
  http://localhost:3000/**
  ```
  Preview 배포는 커밋마다 도메인이 바뀌므로, Preview에서도 회원가입을 테스트하려면
  `https://reframe-lab-*.vercel.app/**` 같은 와일드카드 항목이 추가로 필요하다.

## 4. 배포 후 확인

브라우저에서 배포 URL을 열고 아래를 확인한다.

- [ ] Home에 오늘의 렌즈가 뜬다 (로딩 문구에서 멈추지 않는다)
- [ ] 로그인 → 훈련 7단계 완주 → Result 도달
- [ ] 기록 · 성장 화면이 뜬다
- [ ] 회원가입 시 확인 메일 링크가 **배포 도메인**으로 온다 (3번이 안 되어 있으면
      localhost로 오거나 거부된다)
- [ ] iPhone Safari에서 공유 → 홈 화면에 추가 → standalone 실행 (§14-I)

## 5. 배포 후에도 남는 항목

- **§14-D — AI 제공자 미연결.** 지금은 Mock 코치(고정 질문 은행)로만 동작한다.
  7단계 완주와 자기 점검 경로는 정상이라 앱 구조·PWA 검증에는 지장이 없다.
  제공자를 정하면 `getActiveCoachProvider()`(`src/lib/ai/providers/index.ts`)
  한 곳만 교체하면 되고, API Key는 `NEXT_PUBLIC_` 없이 서버 전용 환경변수로 넣는다.
- **§14-H — 개인정보 보존·삭제 정책.** 본인 외 사용자에게 URL을 공유하기 전에 정한다.
- **Deployment Protection.** Preview URL은 기본적으로 URL을 아는 사람이면 열 수 있다.
  본인만 쓰려면 Project Settings → Deployment Protection에서 Vercel Authentication을
  켠다.
- **Supabase 보안 권고 1건** — `auth_leaked_password_protection`(WARN). Authentication
  → Policies에서 켤 수 있는 대시보드 설정이라 코드로는 못 고친다.
