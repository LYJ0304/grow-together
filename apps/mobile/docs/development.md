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

## Authentication settings

`EXPO_PUBLIC_APP_ENV` selects `development` (default), `staging`, or
`production`. Invalid values fail configuration validation. The shared `env`
module controls API configuration and authentication preview in both the UI and
session layer. This deployment environment is independent of `NODE_ENV`.

Development and production require `EXPO_PUBLIC_API_URL`. Staging permits an
omitted or blank URL for UI preview; API actions then return `API_NOT_CONFIGURED`
without sending a network request. Supplying a URL enables normal API access.
Use the computer's LAN address for physical devices.

`EXPO_PUBLIC_ENABLE_AUTH_BYPASS` unset or `true` enables labeled UI preview in
development and staging. Explicit `false` disables it for API validation.
Production always disables preview, including when this setting is `true`.
Preview does not grant access to protected API requests.

To export staging with no API connection, remove the API URL from the deployment
environment and any loaded `.env` files, then run:

```bash
EXPO_PUBLIC_APP_ENV=staging npx expo export --platform web
```

Serve that export with a static server that maps extensionless routes such as
`/login` to `login.html`, then run
`npm run test:env:ui -- http://localhost:8135` against it. The browser check
verifies the missing-API login notice, preview entry, and absence of API requests
or page errors. Install Playwright Chromium (`npx playwright-core install chromium`)
and its system dependencies, or set `CHROME_PATH` to an installed Chrome binary.

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

Serve a web build with `EXPO_PUBLIC_ENABLE_AUTH_BYPASS=true` to exercise both
login and preview paths. From `apps/mobile`, run:

```bash
npm run test:plan -- http://localhost:8171
```

This runs the todo CRUD/form browser suite with intercepted API responses and
Chrome (`CHROME_PATH` defaults to `/usr/bin/google-chrome`). It checks saves,
input retention, duplicate prevention, date/account isolation, lost responses,
and the narrow layout. It does not prove connectivity to a live API. For live
validation, disable preview, use a test account, and check CRUD, reload, and
account switching against the configured API.

## 아이 프로필 추가·수정

마이페이지의 아이 프로필은 미등록 시 추가, 등록 후에는 요약과 수정 화면을 제공한다. 로그인 상태에서는 `/api/v1/children/me`를 GET으로 조회하고, 최초 추가는 POST, 수정은 PUT으로 저장한다. 요청은 공통 인증 세션을 사용하며 소유자는 서버가 JWT로 결정한다. 계정당 아이 한 명의 이름·생년월일을 저장하고, 같은 계정으로 다른 기기에서 로그인하면 서버 값을 조회한다.

GET 404만 미등록으로 처리한다. 다른 조회 오류는 재시도 화면을 제공하며 저장 실패·취소는 기존 값과 작성 중인 입력을 보존한다. POST 409는 자동 덮어쓰기를 하지 않고 `등록 정보 다시 확인`을 제공한다. 재조회해도 입력은 유지되며, 서버 프로필이 있으면 이후 저장은 수정으로 진행된다. 로그아웃·계정 전환 후 이전 요청의 응답은 현재 계정 화면에 반영하지 않는다.

미리보기는 `@growtogether/child/v1/preview`의 기기 로컬 저장을 유지하며 child API를 호출하지 않는다. 로그인 계정의 기존 로컬 프로필은 서버로 자동 이관하거나 조회 대체값으로 사용하지 않으며 삭제하지도 않는다. 서버 미등록 계정은 아이 추가에서 다시 입력해야 한다.

`npm run test:children:api`는 인증·refresh·GET/POST/PUT·404/409·오류·이전 세션 응답과 조회 훅의 인증/미리보기 분기를 검증한다. `npm run test:children:storage`는 미리보기에서 사용하는 로컬 저장과 입력 검증을 확인한다.

환경 변수를 바꿔 검증 빌드를 만들 때는 `npx expo export --platform web --clear --max-workers 2`로 이전 환경의 변환 캐시를 비운다. export 서버는 `/children`처럼 확장자가 없는 경로를 해당 `.html` 파일로 연결해야 한다.

Expo web export를 제공하는 서버를 준비한 뒤 `CHILDREN_URL=http://localhost:8141 BROWSER_EXECUTABLE_PATH=/opt/google/chrome/chrome npm run test:children:ui`로 추가·수정·복원·취소·오류·충돌·계정 분리·반응형과 API 없는 미리보기를 확인한다. 이 테스트는 API 응답을 가로채므로 실제 API 연결을 증명하지 않는다.

실제 API 확인은 운영 데이터가 없는 독립 로컬 API/DB를 준비하고, web 빌드의 `EXPO_PUBLIC_API_URL`과 API의 `CORS_ALLOWED_ORIGINS`를 맞춘 뒤 `CHILDREN_URL=http://localhost:8141 CHILDREN_API_URL=http://localhost:18141 npm run test:children:live`로 실행한다. 임시 테스트 계정을 생성하며 등록·수정·마이페이지 반영·재로그인·별도 브라우저 조회·새로고침을 검증한다. 테스트 계정은 해당 임시 DB에 남는다. 주소와 브라우저 경로는 실행 환경에 맞게 지정한다.

## 홈·일기 UI 검증

홈은 아이 이름·월령과 날짜 → 다음 활동 → 일정 요약 → 기록 순서다. 일정과 아이 정보는 기존 API를 사용하며, 미리보기에서는 보호된 API를 호출하지 않는다. 네 메뉴는 오늘·일정·기록·질문이며 프로필과 설정은 상단 버튼으로 연다. 날짜와 초안은 로그인 세션 안에서 보존한다.

홈과 일기는 `src/components/typography.ts`의 역할별 스타일을 공유한다. 짧은 제목은 Jua, 본문·입력·버튼은 플랫폼 시스템 글꼴이다. 본문 읽기와 수정은 같은 16px/27px 규칙을 사용한다.

실행 방법과 실제 저장 범위·미연결 계약은 [기록과 일기 작성](diary-editing.md)을 참고한다. 환경 변수를 변경했다면 export에 `--clear`를 사용해 이전 Metro 변환 캐시를 제거한다.

```bash
MAIN_URL=http://localhost:8156 MOBILE_URL=http://localhost:8156 BROWSER_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:main:ui
MOBILE_URL=http://localhost:8156 BROWSER_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:diary:typography
MOBILE_URL=http://localhost:8156 BROWSER_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:ux
```

홈 검사는 프로필·월령·미등록·오류·재시도·자정·복귀·다음 활동과 반응형을 확인한다. 일기 검사는 완료 재료 선택·직접 작성·초안/편집본 보존·저장 실패·수정/삭제·타이포그래피를 확인한다. API 응답은 가로채므로 실서버 연결을 증명하지 않으며 네이티브 키보드·사진 권한·OS 글씨 확대는 기기에서 별도로 확인한다.
