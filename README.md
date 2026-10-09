# GrowTogether

GrowTogether is a mobile application platform for AI-assisted growth. This repository provides the initial, independently runnable foundation for mobile, API, database, and general-purpose AI work. It intentionally contains no provider-specific AI or RAG business logic.

## Stack

- Mobile: Expo SDK 55, React Native 0.83, TypeScript, Expo Router, TanStack Query, Zustand
- API: Java 21, Spring Boot 4.1, Gradle
- AI worker: Python 3.12, uv, Pydantic Settings, Ruff, Pytest
- Data: PostgreSQL 16 with pgvector
- Infrastructure: Docker Compose; CI: GitHub Actions

## Layout

```text
apps/mobile       Expo mobile client
apps/api          Spring Boot API
apps/ai-worker    independent AI job runner
contracts         OpenAPI contracts
infra             Compose and PostgreSQL initialization
```

## Local setup

Copy the example configuration, then adjust only local values:

```bash
cp .env.example .env
docker compose -f infra/compose.yaml up --build
```

The compose stack starts PostgreSQL and the API. Run the one-shot example worker explicitly:

```bash
docker compose -f infra/compose.yaml --profile worker run --rm ai-worker
```

`pgvector` is enabled by `infra/postgres/init.sql` when the database volume is first created. To re-run initialization during local development, remove only the named `growtogether_postgres-data` volume after confirming it has no needed data.

The corrected defaults use project, database, and user name `growtogether`. If you already have a database volume created with earlier names, retain its existing `COMPOSE_PROJECT_NAME`, `POSTGRES_DB`, and `POSTGRES_USER` values in `.env` to reuse it. Changing the Compose project name changes the default volume name; it does not rename or migrate existing volumes or databases. The mobile URL scheme is now `growtogether`; native builds must be rebuilt to register the corrected scheme.

## Run apps without Compose

```bash
# API (requires a reachable PostgreSQL instance)
cd apps/api && ./gradlew bootRun

# AI worker
cd apps/ai-worker && uv sync && uv run python -m app.main

# Mobile
cd apps/mobile && npm install && npm start
```

Set `EXPO_PUBLIC_API_URL` for the mobile client. `http://localhost:8080` is appropriate for web/iOS Simulator; Android Emulator typically uses `http://10.0.2.2:8080`, and a physical device needs the host machine's LAN address. Never put LLM keys or backend secrets in Expo public variables.

## Tests and checks

```bash
cd apps/mobile && npm run typecheck && npm run lint && npm run format:check
cd apps/api && ./gradlew build
cd apps/ai-worker && uv sync --locked && uv run ruff check . && uv run pytest
```

The health endpoint is `GET /api/health`; it returns `{"status":"UP","service":"growtogether-api"}`. Spring Actuator is available at `/actuator/health`.

## API authentication

Set `JWT_SECRET` to a private Base64-encoded random key of at least 32 bytes before starting the API (`openssl rand -base64 32` generates one). Put the value in your local environment or untracked `.env`, never in source control. For standalone `bootRun`, export the variables into the process environment; Spring does not automatically load the repository `.env`. Compose forwards them from `.env`. Access JWTs default to 900 seconds and login sessions to 1,209,600 seconds (14 days); `JWT_ACCESS_TOKEN_SECONDS` and `JWT_REFRESH_SESSION_SECONDS` override these values.

The API refuses to start with an absent, malformed, or short signing key; standalone PostgreSQL and AI worker commands do not require that key. `CORS_ALLOWED_ORIGINS` is a comma-separated list of allowed web origins (local Expo origins by default); set your actual web deployment origin when connecting the web client. Cookies are not used for these native-client token endpoints.

- `POST /api/v1/auth/signup`: `{ "name": "Parent", "email": "parent@example.com", "password": "your-password" }` → 201. Names are trimmed and emails lowercased. Passwords use BCrypt (cost 12) and cannot exceed 72 UTF-8 bytes.
- `POST /api/v1/auth/login`: email/password → 200 with `accessToken`, `refreshToken`, `tokenType: "Bearer"`, and `expiresIn` in seconds.
- `POST /api/v1/auth/refresh`: `{ "refreshToken": "..." }` → new access and refresh tokens. Replace the stored refresh token after every success. Serialize refresh requests: using an old token again revokes the entire session.
- `POST /api/v1/auth/logout`: `{ "refreshToken": "..." }` → 204, including repeated logout. This revokes only that login/device session and immediately invalidates its access JWTs. Clear tokens on the client as well.

Other API routes require `Authorization: Bearer <accessToken>`; health endpoints remain public. Auth endpoints authenticate from their request bodies, so an expired access header does not prevent refreshing or logging out. Error bodies have `code` and `message` (400 invalid input, 409 duplicate email, 401 invalid credentials/token). Token responses are not cached. JWT verification also checks the persisted session on each request to enforce logout and replay revocation immediately; this deliberately requires a DB lookup rather than fully stateless token verification.

Flyway creates `users`, `auth_sessions`, and `refresh_tokens` on a fresh database before Hibernate validates the schema. If you already manually created tables, inspect and baseline/migrate that database deliberately before starting; automatic baselining is not enabled and existing tables are not dropped. Expired session rows and their refresh-token history can be removed after the retention period; foreign keys cascade token deletion. The mobile UI preview has not yet been wired to these endpoints.

Authentication integration tests use isolated PostgreSQL Testcontainers and runtime-generated test signing keys. Run `cd apps/api && ./gradlew test`; when Docker is unavailable, container-backed tests are skipped.

When run standalone, the API defaults to database and user `growtogether`. To use an existing database with a different name, set `DATABASE_URL` and `POSTGRES_USER` explicitly. Compose passes these values from its existing PostgreSQL configuration; this does not rename or migrate an existing database.

The mobile launch transition browser check uses Node.js 22+ and Chrome's DevTools protocol, without additional test dependencies. Export the web app with `npx expo export --platform web`, serve `apps/mobile/dist` on port 8093, and run Chrome with `--remote-debugging-port=9223` and a separate temporary `--user-data-dir`. From `apps/mobile`, run `npm run test:motion`; optional site and DevTools URLs can be passed as `npm run test:motion -- http://localhost:8093 http://localhost:9223`. The check covers both title animations, fades, repeated taps, back navigation, viewport resizing, reduced motion, and automatic progression to the login/signup selection without clicks. The logo screen waits 1 second; the app-name screen waits 0.7 seconds after its transition completes. Returning to a previous screen does not replay automatic progression.

For UI QA, both login and signup selection buttons open the Figma Main screen directly. This is a preview flow, not authentication; the child age, routine progress, schedule, and AI diary use the Figma sample data. The browser check verifies both entry buttons, Main assets, and safe bottom navigation.

The bottom calendar tab opens the diary calendar, initially matching Figma's November 2025 view with November 13 selected. Users can change months and select dates; the home tab returns to Main. Diary generation currently shows a preparation notice rather than invoking an AI service. The browser check includes calendar navigation, date selection, and month/year rollover.

## Troubleshooting

- If API startup cannot connect, verify PostgreSQL with `docker compose -f infra/compose.yaml ps` and confirm `.env` values match.
- If pgvector is missing in an existing local database, run `CREATE EXTENSION IF NOT EXISTS vector;` as a database administrator.
- Expo device networking is not equivalent to desktop `localhost`; use the address appropriate to the device or emulator.
