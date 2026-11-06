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

마이페이지의 아이 프로필은 미등록 시 추가, 등록 후에는 요약과 수정 화면을 제공한다. 이름과 생년월일은 `@growtogether/child/v1/<계정 키>`에 기기 로컬로 저장하며 서버·다른 기기와 동기화하지 않는다. 계정 키는 인증 경계가 제공하는 JWT issuer/subject 조합이고 미리보기는 별도 키를 사용한다. 이는 저장 분리용이며 서버 인가를 대체하지 않는다.

조회 실패는 미등록과 구분하고, 저장 실패·취소는 기존 저장값을 유지한다. 로그아웃·계정 전환 시 화면과 캐시를 초기화하며 계정 정보가 없는 세션에서는 공용 키로 저장하지 않는다.

`npm run test:children:storage`, `npm run test:auth`로 저장/인증 경계를 검증한다. Expo web export를 제공하는 서버를 준비한 뒤 `CHILDREN_URL=http://localhost:8130 BROWSER_EXECUTABLE_PATH=/opt/google/chrome/chrome npm run test:children:ui`로 추가·수정·복원·취소·오류·계정 분리와 반응형을 확인한다. 브라우저 경로와 서버 주소는 실행 환경에 맞게 지정한다.
