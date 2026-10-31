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

`EXPO_PUBLIC_ENABLE_AUTH_BYPASS` defaults to false. Explicit `true` enables labeled
UI preview only; protected API requests remain unavailable. Keep it false for API
validation and Production. Use the actual API endpoint in `EXPO_PUBLIC_API_URL`
(LAN address for physical devices). Never put secrets in `EXPO_PUBLIC_*` settings.

See [authentication](authentication.md) for token storage, session recovery,
refresh, and logout behavior.

## Checks

From `apps/mobile`:

```bash
npm run typecheck
npm run lint
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
