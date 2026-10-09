# GrowTogether

A mobile app with an independent API and AI worker.

## Start locally

Requirements: Docker Compose and Node.js. Java 21 is needed to run the API outside Docker; Python 3.12 and `uv` are needed for the AI worker.

```bash
cp .env.example .env
openssl rand -base64 32
```

Set `JWT_SECRET` in `.env` to the generated value, then start PostgreSQL and the API:

```bash
docker compose --env-file .env -f infra/compose.yaml up --build
```

Keep `.env` local; never commit its secret. The API is available at `http://localhost:8080`.

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
docker compose --env-file .env -f infra/compose.yaml --profile worker run --rm ai-worker
```

## Checks

```bash
(cd apps/mobile && npm run typecheck && npm run lint)
(cd apps/api && ./gradlew test)
(cd apps/ai-worker && uv sync --locked && uv run ruff check . && uv run pytest)
```

API tests use PostgreSQL Testcontainers and require Docker. The API contract is in [contracts/openapi.yaml](contracts/openapi.yaml); health is available at `/api/health`.
