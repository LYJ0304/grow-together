# Grow Together Admin Console

독립 실행하는 Next.js App Router 기반 **Frontend-only prototype**입니다. 화면에 표시되는 모든 계정, 지표, 오류, 감사 로그는 가상 데이터입니다. 실제 인증, 관리자 권한 검증, API/Worker/DB 연결은 없습니다. 로그인 없이도 모든 경로의 공개 샘플을 볼 수 있습니다. Mock 로그인은 접근 제어가 아닙니다.

## 실행

Node.js **22.18 이상** (검증 환경: 24.22.1), npm을 사용합니다. 저장소 루트에 npm workspace를 추가하지 않았으며 다른 앱의 설정과 lockfile은 변경하지 않습니다.

```sh
cd apps/admin
npm ci
npm run dev
# http://localhost:3001
```

```sh
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
npm start
# 별도 터미널에서, Chromium 설치 후
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
```

`ADMIN_URL`로 브라우저 테스트 대상(기본 http://127.0.0.1:3001), `ADMIN_ARTIFACTS`로 스크린샷 디렉터리(기본 /tmp/grow-admin-screenshots)를 변경할 수 있습니다. Playwright는 `playwright-core`만 사용하며 브라우저를 자동 다운로드하지 않습니다.

## 화면과 동작

| 경로        | 기능                                                                             |
| ----------- | -------------------------------------------------------------------------------- |
| `/login`    | 임의 샘플 이메일/비밀번호 검증, pending/error, Mock 로그인                       |
| `/`         | 6개 KPI, 기간별 가입 추이/AI 사용량, 시스템 상태, 최근 오류/관리 작업            |
| `/users`    | 검색, 상태 필터, 가입일 정렬, 페이지네이션, 상세 Sheet, 계정 상태/세션 철회 확인 |
| `/ai`       | 기간/기능/상태 필터, 요청·성공·실패 추이, 토큰·비용, 기능 구현 상태, 오류 상세   |
| `/system`   | 4개 서비스의 고정 샘플 상태와 응답시간, 상세 Sheet                               |
| `/audit`    | 작업자/작업/대상 검색, 작업 유형·KST 날짜 필터, 페이지네이션, 상세               |
| `/settings` | General, Feature Flags, AI Usage Limits, 가상 Admin Profile, 초기화              |

상단 `화면 상태 미리보기`에서 정상/로딩/빈 데이터/오류 UI를 확인합니다. 로딩/오류 시나리오는 실제 통신 상태가 아닙니다. 사용자 계정 상태/설정 변경은 React Context의 메모리에만 저장하고 로컬 감사 이벤트를 추가합니다. 새로고침하면 초기화됩니다. 세션 철회는 확인 및 감사 이벤트 시뮬레이션만 수행합니다.

Mock 로그인은 형식이 올바른 이메일과 임의의 8자 이상 문자열을 받습니다. **실제 자격 증명을 입력하지 마세요.** 비밀번호·입력 이메일을 저장하거나 전송하지 않습니다. sessionStorage에는 데모 시작 여부를 나타내는 boolean 성격의 문자열만 기록하며 경로 보호에 사용하지 않습니다. `/login` 이동도 실제 인증을 만들지 않습니다.

## 구조 및 반응형

- `app`: Server Component 라우트와 레이아웃. 인터랙션이 필요한 화면은 `features` Client Component로 분리.
- `components/layout`: 공통 shell, navigation, mobile drawer, header.
- `components/shared`: KPI, 표/모바일 목록, 필터, 상태, 상세/확인 UI, 접근 가능한 차트.
- `components/ui`: 공식 shadcn/ui 기반 Radix 컴포넌트.
- `lib/mock`: 결정적인 fixture와 비동기 repository. 조회/집계는 UI와 분리.
- `lib/types`: 현재 UI 데이터 모델. 서버 계약으로 간주하지 않음.
- `lib/demo-context`: 로컬 데모 변경, 공통 상태 시나리오, 안내.

1024px 이상은 고정 sidebar와 table, 640–1023px는 접고 펼칠 수 있는 sidebar와 목록, 639px 이하는 상단 header + navigation Sheet를 사용합니다. 모바일 목록은 가로 스크롤 표로 대체하지 않습니다. 상세 Sheet는 모바일에서 전체 너비, 큰 화면에서는 최대 520px입니다. Radix가 focus trap, Escape, 배경 스크롤 잠금, 포커스 복귀를 처리합니다. 주요 컨트롤은 최소 44px 터치 영역을 갖습니다. CSS env safe-area, 100dvh, 키보드 focus, reduced motion을 지원합니다.

차트는 Recharts의 반응형 컨테이너, 클릭/터치 Tooltip, 키보드 접근성과 같은 값을 보여주는 `표로 보기`를 제공합니다. 모든 집계 날짜는 Asia/Seoul 캘린더 날짜입니다. 스냅샷은 2026-11-21 KST로 고정됩니다. 상태 색상은 텍스트와 함께 표시합니다.

기존 브랜드 primary #B25447, brand #D26A5C, tint #FDEDE6, background #FAF9F9, surface #FFFFFF를 CSS 변수로 재사용합니다. 의미 있는 상태에만 green/amber/red를 사용합니다. Dark Mode는 구현하지 않았습니다. 변수를 통해 추후 확장할 수 있습니다.

## shadcn/ui 출처

공식 `new-york-v4` 컴포넌트 소스를 사용했습니다:
https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/new-york-v4/ui

레지스트리 접속 실패로 CLI 생성 대신 공식 GitHub 소스를 가져왔습니다. import 경로와 브랜드 변수, 44px 터치 영역 및 한국어 닫기 레이블을 조정했습니다. [MIT 라이선스](SHADCN-LICENSE.md)를 포함했습니다. 새 인증/전역 상태 라이브러리는 없습니다.

## 배포

Vercel의 **별도 프로젝트**에서 Root Directory를 `apps/admin`, framework를 Next.js로 선택하고 기본 `npm run build`/Next.js output을 사용합니다. 별도 SPA rewrite나 mobile의 Vercel 설정 변경이 필요하지 않습니다. 이번 작업은 실제 배포 설정 변경/배포를 수행하지 않습니다. 공개 배포 시에도 Demo 배너와 noindex 메타데이터를 유지하세요. noindex는 보안 기능이 아닙니다. 환경변수나 비밀정보가 필요하지 않습니다.

## 실제 Admin API 연동 시

1. 서버 인증/세션, 관리자 RBAC, 모든 endpoint의 서버 권한 검증, CSRF/감사 정책을 먼저 설계합니다. Mock sessionStorage 플래그를 인증으로 재사용하지 않습니다.
2. 현 `/api/v1` 규칙에 맞는 별도 Admin API 계약/DTO/오류/서버 페이지네이션을 확정하고 `lib/mock/repository.ts` 접근 경계를 API client로 교체합니다. 이번 PR은 API 계약을 만들거나 수정하지 않습니다.
3. 데모 Context mutation을 서버 작업으로 교체하고 pending/중복 방지, 실패 복구, 재조회, 계정별 캐시 격리를 추가합니다.
4. 실측 AI 집계/비용 단가/시간대/보존 정책을 확정합니다. Schedule Generation과 Weekly Report는 기존 구현 경로가 있지만 이 콘솔과 미연결이며 Diary AI/Chat AI의 서버 연동은 Planned입니다.
5. 실제 사용자 데이터 최소화, 감사 로그 서버 저장, 데이터 내보내기/권한/보관 정책을 검토합니다. 아이/일기/상담의 민감한 내용은 이 UI 모델에 포함하지 않았습니다.

브라우저 검사는 Chromium에서 실행합니다. iOS Safari/설치형 PWA, Android Chrome 실기기, 스크린 리더와 OS 키보드 실측은 별도 확인이 필요합니다.
