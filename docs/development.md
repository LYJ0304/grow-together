# Development Reference

The root [README](../README.md#getting-started) covers a first local run. This
reference keeps the environment, checks, and operations details close at hand.
Commands below are repository-defined entry points, not a claim that all services
or test suites have been executed in your environment.

## Environment files

| Template                                                | Main settings                                                                                              | Scope                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [infra/.env.example](../infra/.env.example)             | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`                                                        | Local Compose database                                      |
| [apps/mobile/.env.example](../apps/mobile/.env.example) | `EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_ENABLE_AUTH_BYPASS`                             | Public client configuration only                            |
| [apps/api/.env.example](../apps/api/.env.example)       | `DATABASE_URL`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`, `WORKER_BASE_URL`, `AI_WORKER_API_KEY`, AWS settings | API persistence, authentication, storage, internal requests |
| [apps/worker/.env.example](../apps/worker/.env.example) | `SERVICE_NAME`, `LOG_LEVEL`, `AI_WORKER_API_KEY`, `OPENROUTER_API_KEY`, `LLM_*_MODEL`                      | Worker configuration and provider credentials               |

Compose supplies the API database connection from `infra/.env` and overrides its
Worker URL to `http://worker:8000`. It does not start the optional Worker unless
its profile is enabled. The API and Worker must share the service key; the
OpenRouter key stays only in the Worker. Never commit real `.env` files.

Expo loads the mobile `.env` automatically. Spring Boot does **not** load the API
`.env` automatically when running a host JVM. The Worker uses pydantic-settings
to load its `.env`. The Admin demo requires no secrets or Admin password variable.

## Common commands

| Run from        | Command                                                                                       | Purpose                                                                 |
| --------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Repository root | `docker compose --env-file infra/.env -f infra/compose.yaml up --build`                       | Database and API                                                        |
| Repository root | `docker compose --env-file infra/.env -f infra/compose.yaml --profile worker up --build`      | Database, API, and internal Worker server                               |
| Repository root | `docker compose --env-file infra/.env -f infra/compose.yaml --profile worker run --rm worker` | One-off Worker server; does not publish a host port or start the API    |
| `apps/mobile`   | `npm ci` then `npm start` / `npm run web`                                                     | Expo / web client                                                       |
| `apps/mobile`   | `npm run typecheck` / `npm run lint`                                                          | Type and lint checks                                                    |
| `apps/mobile`   | `npm run test:auth`                                                                           | Authentication/session tests                                            |
| `apps/api`      | `./gradlew test`                                                                              | API checks; PostgreSQL integration tests require Docker                 |
| `apps/worker`   | `uv sync --locked`                                                                            | Worker dependencies                                                     |
| `apps/worker`   | `uv run uvicorn app.main:app --port 8000`                                                     | Host Worker server                                                      |
| `apps/worker`   | `uv run python -m app.main`                                                                   | Legacy example job, not the HTTP server; requires valid Worker settings |
| `apps/worker`   | `uv run ruff check .` / `uv run pytest`                                                       | Lint and tests                                                          |
| `apps/admin`    | `npm ci` then `npm run dev`                                                                   | Mock console on port 3001                                               |
| `apps/admin`    | `npm run typecheck` / `npm run lint` / `npm test` / `npm run build`                           | Admin checks and build                                                  |

There are no tracked GitHub Actions workflows at the time of this documentation
update. These commands describe local verification; this repository does not
publish a CI-passing claim or badge here. Browser checks need the browser/runtime
specified by their module guides.

## Host development and API exploration

Java 21 is needed to run the API outside Docker; Python 3.12+ and uv are needed
for a host Worker. Use a supported Node version from the README for each client.

The Compose PostgreSQL service does not publish port 5432. Follow the
[API development guide](../apps/api/docs/development.md#run-outside-docker) to
expose a local database safely, load API variables, and run `./gradlew bootRun`.
Do not start competing database processes against the same volume.

The local API is at `http://localhost:8080`. Swagger UI at
`http://localhost:8080/swagger-ui.html` serves the canonical
[OpenAPI contract](../contracts/openapi.yaml); protected operations still require
JWT authentication. `/actuator/health` includes database health.

For a phone, use the development computer's LAN address in the public mobile API
URL. For browser API calls, allow the actual Expo origin in `CORS_ALLOWED_ORIGINS`.
Disable authentication preview for end-to-end authentication checks. See
[mobile development](../apps/mobile/docs/development.md) and
[authentication/session behavior](../apps/mobile/docs/authentication.md).

## Deployment and releases

`main` is the only long-lived branch; staging and production are deployment
environments. Task PRs target `main`. App tags (`mobile/v*`, `api/v*`, `worker/v*`)
reference independently verified release commits. Publishing a tag is separate
from a deployment and does not configure provider triggers or prove a successful rollout.

See [Render API staging](../apps/api/docs/staging/Development.md) for that
environment's configuration and verification. The mobile app exports static HTML;
its [Vercel guide](../apps/mobile/docs/development.md#vercel-정적-web-경로) explains
extensionless routes. The [Admin README](../apps/admin/README.md#배포) describes a
separate Next.js project rooted at `apps/admin`. No live deployment URLs or
production availability are asserted here.

## Further reading

- [Local development](../infra/docs/local-development.md) — base Compose setup; use the current Worker server commands above for AI flows.
- [API development](../apps/api/docs/development.md) · [schedule generation](../apps/api/docs/schedule-generation.md) · [weekly reports](../apps/api/docs/weekly-reports.md)
- [Worker development](../apps/worker/docs/development.md) · [Worker weekly reports](../apps/worker/docs/weekly-reports.md)
- [Mobile report integration boundary](weekly-report-mobile.md)
- [Contribution rules](../AGENTS.md) · [repository workflow](../.harness/conventions.md)
