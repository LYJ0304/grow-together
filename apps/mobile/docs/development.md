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
