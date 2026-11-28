# Mobile development

Prepare the environment and start PostgreSQL/API with the
[local development guide](../../../infra/docs/local-development.md).
Expo loads this module's `.env`; use the [environment template](../.env.example).

## Run Expo

From the repository root, in another terminal:

```bash
cd apps/mobile
npm ci
npm start
```

For a physical phone, use the computer's LAN address instead of `localhost`:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:8080 npm start
```

Replace the example IP with the computer's LAN address.

For phone QA away from the local network, follow the
[MacBook staging guide](../../api/docs/staging/Development.md). It sets the
Tailscale API and Metro URLs and requires login.

## Vercel 정적 Web 경로

`app.json`의 `expo.web.output`은 `static`이며 export는 경로별 HTML을 생성한다.
앱 루트의 `vercel.json`은 `cleanUrls: true`로 `/children` → `children.html`처럼
확장자 없는 경로를 처리한다. 모든 경로를 `index.html`로 보내는 SPA fallback은 사용하지 않는다.
환경변수, 빌드 명령, 출력 디렉터리와 네이티브 라우팅 설정은 변경하지 않는다.

이 설정 파일은 Vercel의 기존 Root Directory가 `apps/mobile`일 때 읽힌다.
실제 대시보드의 Root Directory와 배포 산출물을 확인해야 하며, 저장소 루트에서 빌드하는
프로젝트라면 기존 Root Directory를 바꾸지 말고 그 위치에서 설정을 읽도록 맞춘다.
배포 후 `/`, `/children`, `/login`, `/diary?id=<실제 일기 ID>`에 직접 접근하고
새로고침해 서버 404가 없는지 확인한다. 로그인하지 않은 보호 화면의 로그인 이동은 정상이다.
현재 `[id]` 동적 경로는 없고 상세 ID는 query parameter로 전달한다. 존재하지 않는 경로나
누락된 JS 자산까지 HTML로 응답하도록 바꾸지 않는다.

## Authentication settings

`EXPO_PUBLIC_APP_ENV` selects `development` (default), `staging`, or
`production`. Invalid values fail configuration validation. The shared `env`
module controls API configuration. This deployment environment is independent of `NODE_ENV`.

Development and production require `EXPO_PUBLIC_API_URL`. Staging permits an
omitted or blank URL for the authentication screen; API actions then return `API_NOT_CONFIGURED`
without sending a network request. Supplying a URL enables normal API access.
Use the computer's LAN address for physical devices.

Mobile feature screens require a valid authenticated session. Use test accounts against the configured API or authenticated test fixtures with mocked API responses.

To export staging with no API connection, remove the API URL from the deployment
environment and any loaded `.env` files, then run:

```bash
EXPO_PUBLIC_APP_ENV=staging npx expo export --platform web
```

The authentication screen remains available, but login requires a configured API. `npm run test:env` checks missing-API errors without making a request.

For production, set `EXPO_PUBLIC_APP_ENV=production` and the actual
`EXPO_PUBLIC_API_URL` before building. These public settings are bundled into the
app; rebuild to change them. Never put secrets in `EXPO_PUBLIC_*` settings.

See [authentication](authentication.md) for token storage, session recovery,
refresh, and logout behavior.

## Checks

From `apps/mobile`:

```bash
npm run typecheck
npm run lint
npm run test:env
npm run test:auth
```

See [launch drawing assets and verification](launch-logo.md) for logo generation,
rendering decisions, and browser checks.

## Todo API UI checks

The todo screen uses the authenticated session and the existing Todo API client.
Dates use local `YYYY-MM-DD` values; times are sent as `HH:mm:ss`. Preview mode
shows no server records and does not send protected requests.

Mobile feature screens require a valid authenticated session. Use test accounts against the configured API or authenticated test fixtures with mocked API responses.

```bash
npm run test:plan -- http://localhost:8171
```

This runs the todo CRUD/form browser suite with intercepted API responses and
Chrome (`CHROME_PATH` defaults to `/usr/bin/google-chrome`). It checks saves,
input retention, duplicate prevention, date/account isolation, lost responses,
and the narrow layout. It does not prove connectivity to a live API. For live
validation, use a test account, and check CRUD, reload, and
account switching against the configured API.

## 아이 프로필 추가·수정

마이페이지의 아이 프로필은 미등록 시 추가, 등록 후에는 요약과 수정 화면을 제공한다. 로그인 상태에서는 `/api/v1/children/me`를 GET으로 조회하고, 최초 추가는 POST, 수정은 PUT으로 저장한다. 요청은 공통 인증 세션을 사용하며 소유자는 서버가 JWT로 결정한다. 계정당 아이 한 명의 이름·생년월일을 저장하고, 같은 계정으로 다른 기기에서 로그인하면 서버 값을 조회한다.

GET 404만 미등록으로 처리한다. 다른 조회 오류는 재시도 화면을 제공하며 저장 실패·취소는 기존 값과 작성 중인 입력을 보존한다. POST 409는 자동 덮어쓰기를 하지 않고 `등록 정보 다시 확인`을 제공한다. 재조회해도 입력은 유지되며, 서버 프로필이 있으면 이후 저장은 수정으로 진행된다. 로그아웃·계정 전환 후 이전 요청의 응답은 현재 계정 화면에 반영하지 않는다.

기존 체험 모드의 로컬 데이터는 읽거나 자동 이관하지 않으며 삭제하지도 않는다. 서버 미등록 계정은 아이 추가에서 다시 입력해야 한다.

`npm run test:children:api`는 인증·refresh·GET/POST/PUT·404/409·오류·이전 세션 응답과 조회 훅의 인증 및 비로그인 조회 차단를 검증한다. `npm run test:children:storage`는 아이 정보 입력 검증을 확인한다.

환경 변수를 바꿔 검증 빌드를 만들 때는 `npx expo export --platform web --clear --max-workers 2`로 이전 환경의 변환 캐시를 비운다. export 서버는 `/children`처럼 확장자가 없는 경로를 해당 `.html` 파일로 연결해야 한다.

Expo web export를 제공하는 서버를 준비한 뒤 `CHILDREN_URL=http://localhost:8141 BROWSER_EXECUTABLE_PATH=/opt/google/chrome/chrome npm run test:children:ui`로 추가·수정·복원·취소·오류·충돌·계정 분리·반응형를 확인한다. 이 테스트는 API 응답을 가로채므로 실제 API 연결을 증명하지 않는다.

실제 API 확인은 운영 데이터가 없는 독립 로컬 API/DB를 준비하고, web 빌드의 `EXPO_PUBLIC_API_URL`과 API의 `CORS_ALLOWED_ORIGINS`를 맞춘 뒤 `CHILDREN_URL=http://localhost:8141 CHILDREN_API_URL=http://localhost:18141 npm run test:children:live`로 실행한다. 임시 테스트 계정을 생성하며 등록·수정·마이페이지 반영·재로그인·별도 브라우저 조회·새로고침을 검증한다. 테스트 계정은 해당 임시 DB에 남는다. 주소와 브라우저 경로는 실행 환경에 맞게 지정한다.

## 홈·일기 UI 검증

홈은 프로필·설정 → 월 헤더와 월요일 시작 주간 캘린더 → 선택 날짜와 아이 정보 → 통합 통계 → 활동 목록·진행률 → 작은 일기 CTA → 질문 진입점 순서다. 월간 날짜 선택은 기록 화면 이동 대신 홈 안의 모달에서 수행하며, 선택 날짜는 기존 MainScreen 상태와 Todo/Diary query key를 공유한다. 주간 화살표와 가로 스와이프는 선택 요일을 유지해 7일씩 이동하고, 세로 스크롤은 캘린더 제스처가 가로채지 않는다. 일정 화면은 기존 일요일 시작 주간을 유지하며 날짜 계산 유틸리티만 공유한다.

미래 날짜도 활동 계획용으로 탐색한다. 미래에는 일기 CTA가 활동 추가로 연결되고 빠른 추가의 일기 메뉴는 비활성화된다. 기존 헤더의 미래 이동 차단 외에 DiaryCreateRequest에는 과거/오늘 제한이 없으나, 홈에서는 요청한 기록/계획 UX 정책을 적용하며 API 계약은 변경하지 않는다. 자정과 포그라운드 복귀의 today 갱신은 유지하고 명시적으로 고른 과거 날짜는 초기화하지 않는다. 일정 저장 성공 후에만 완료 상태·진행률·반응 모달이 갱신되며 pending 중 날짜 전환은 잠긴다. 기존 하단 탭·FAB·질문 초안은 유지한다.

홈과 일기는 `src/components/typography.ts`의 역할별 스타일을 공유한다. 짧은 제목은 Jua, 본문·입력·버튼은 플랫폼 시스템 글꼴이다. 본문 읽기와 수정은 같은 16px/27px 규칙을 사용한다.

실행 방법과 실제 저장 범위·미연결 계약은 [기록과 일기 작성](diary-editing.md)을 참고한다. 환경 변수를 변경했다면 export에 `--clear`를 사용해 이전 Metro 변환 캐시를 제거한다.

```bash
MAIN_URL=http://localhost:8156 MOBILE_URL=http://localhost:8156 BROWSER_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:main:ui
MOBILE_URL=http://localhost:8156 BROWSER_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:diary:typography
MOBILE_URL=http://localhost:8156 BROWSER_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:ux
MOBILE_URL=http://localhost:8156 BROWSER_EXECUTABLE_PATH=/usr/bin/chromium npm run test:main:dashboard
MOBILE_URL=http://localhost:8156 BROWSER_EXECUTABLE_PATH=/usr/bin/chromium node tests/header-tools-ui.mjs
```

홈 검사는 프로필·월령·미등록·오류·재시도·자정·복귀·다음 활동과 반응형을 확인한다. 일기 검사는 완료 재료 선택·직접 작성·초안/편집본 보존·저장 실패·수정/삭제·타이포그래피를 확인한다. API 응답은 가로채므로 실서버 연결을 증명하지 않으며 네이티브 키보드·사진 권한·OS 글씨 확대는 기기에서 별도로 확인한다.


기록 탭의 주간 기본 보기·월간 확장·월별 모아보기와 지연 조회 정책은 [기록 탐색 화면](records-browser.md)을 참고한다.
