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

When run standalone, the API defaults to database and user `growtogether`. To use an existing database with a different name, set `DATABASE_URL` and `POSTGRES_USER` explicitly. Compose passes these values from its existing PostgreSQL configuration; this does not rename or migrate an existing database.

The mobile launch transition browser check uses Node.js 22+ and Chrome's DevTools protocol, without additional test dependencies. Export the web app with `npx expo export --platform web`, serve `apps/mobile/dist` on port 8093, and run Chrome with `--remote-debugging-port=9223` and a separate temporary `--user-data-dir`. From `apps/mobile`, run `npm run test:motion`; optional site and DevTools URLs can be passed as `npm run test:motion -- http://localhost:8093 http://localhost:9223`. The check covers both title animations, fades, repeated taps, back navigation, viewport resizing, reduced motion, and automatic progression to the login/signup selection without clicks. The logo screen waits 1 second; the app-name screen waits 0.7 seconds after its transition completes. Returning to a previous screen does not replay automatic progression.

For UI QA, both login and signup selection buttons open the Figma Main screen directly. This is a preview flow, not authentication; the child age, routine progress, schedule, and AI diary use the Figma sample data. The browser check verifies both entry buttons, Main assets, and safe bottom navigation.

The bottom calendar tab opens the diary calendar, initially matching Figma's November 2025 view with November 13 selected. Users can change months and select dates; the home tab returns to Main. Diary generation currently shows a preparation notice rather than invoking an AI service. The browser check includes calendar navigation, date selection, and month/year rollover.

## Troubleshooting

- If API startup cannot connect, verify PostgreSQL with `docker compose -f infra/compose.yaml ps` and confirm `.env` values match.
- If pgvector is missing in an existing local database, run `CREATE EXTENSION IF NOT EXISTS vector;` as a database administrator.
- Expo device networking is not equivalent to desktop `localhost`; use the address appropriate to the device or emulator.
