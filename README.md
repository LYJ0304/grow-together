# GrowTogether

A mobile app with an independent API and AI worker.

## Start locally

Requirements: Docker Compose and Node.js. Java 21 is needed to run the API outside Docker; Python 3.12 and `uv` are needed for the AI worker.

```bash
cp infra/.env.example infra/.env
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
cp apps/ai-worker/.env.example apps/ai-worker/.env
openssl rand -base64 32
```

Set `JWT_SECRET` in `apps/api/.env` to the generated value, then start PostgreSQL and the API:

```bash
docker compose --env-file infra/.env -f infra/compose.yaml up --build
```

Keep each `.env` local; never commit secrets. The API is available at `http://localhost:8080`.

Environment variables are split by responsibility:

- `infra/.env`: PostgreSQL settings for Docker Compose.
- `apps/api/.env`: API profile, JWT, CORS, and database settings for running outside Docker. Compose supplies its database connection from `infra/.env`.
- `apps/mobile/.env`: Expo public settings; Expo loads this file when started from `apps/mobile`.
- `apps/ai-worker/.env`: Worker service name and log level.

To run the API outside Docker, expose PostgreSQL locally and match the API database credentials to `infra/.env`. Spring Boot does not load `.env` automatically; export the API settings before starting it:

```bash
cd apps/api
set -a
source .env
set +a
./gradlew bootRun
```

Run the mobile app in another terminal:

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

The worker currently runs an example job. Run it with:

```bash
docker compose --env-file infra/.env -f infra/compose.yaml --profile worker run --rm ai-worker
```

## Checks

```bash
(cd apps/mobile && npm run typecheck && npm run lint)
(cd apps/api && ./gradlew test)
(cd apps/ai-worker && uv sync --locked && uv run ruff check . && uv run pytest)
```

API tests use PostgreSQL Testcontainers and require Docker. The API contract is in [contracts/openapi.yaml](contracts/openapi.yaml); health is available at `/api/health`.
