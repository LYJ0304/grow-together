# API development

For the default Docker setup, follow the
[local development guide](../../../infra/docs/local-development.md).
The API is available at `http://localhost:8080`.

## Run outside Docker

Use Java 21 and the module's [environment template](../.env.example).
`apps/api/.env` configures the profile, JWT, CORS, and database connection.
Compose overrides its database connection with values from `infra/.env`.

The existing Compose PostgreSQL service does not publish a host port. To use it
with a host JVM, stop the regular Compose stack first so only one PostgreSQL
process uses the data volume. From the repository root, run:

```bash
docker compose --env-file infra/.env -f infra/compose.yaml down
docker compose --env-file infra/.env -f infra/compose.yaml run --rm -p 5432:5432 postgres
```

Keep this terminal open. `down` without `--volumes` preserves the database volume.
Use an available host port and match `DATABASE_URL` if 5432 is already in use.
Alternatively, use an existing local PostgreSQL instance.

Match the API database credentials to `infra/.env` (or your existing PostgreSQL
instance). Spring Boot does not load `.env` automatically. In another terminal,
from the repository root, export the API settings before starting it:

```bash
cd apps/api
set -a
source .env
set +a
./gradlew bootRun
```

## Checks

From `apps/api`:

```bash
./gradlew test
```

Tests use PostgreSQL Testcontainers and require Docker. Check that integration
tests were executed rather than skipped.

## Health and API exploration

`/api/health` returns a fixed UP response. Use `/actuator/health` to check database
connectivity as well.

Swagger UI is available at `/swagger-ui.html` and serves the existing
[OpenAPI contract](../../../contracts/openapi.yaml) via `/openapi.yaml`.
The UI and contract are public; protected API operations still require JWT
authentication. The generated `/v3/api-docs` endpoint is disabled.

Sign up and log in using **Try it out**, then enter the login `accessToken` in
**Authorize → bearerAuth**, without a `Bearer ` prefix. Do not use a refresh token
here. After token refresh, enter the new access token again; reloading the UI
requires authorization again under the default settings.

For Render deployment and staging verification, see the
[staging deployment guide](staging/Development.md).

## AG-UI counseling

`POST /api/v1/chat-threads` creates an owned thread. The authenticated
`POST /api/v1/chat-threads/{threadId}/runs` accepts the text-only AG-UI subset in
`contracts/openapi.yaml`. It checks ownership before contacting the private
worker and relays SSE without collecting the whole response. Other users see
404. Only ownership is stored; message history remains in the client session.
These endpoints are separate from any ongoing `/api/v1/chats` CRUD work.

Set `AI_WORKER_URL` and `WORKER_TOKEN` in the API environment. The token must match
the worker configuration. The worker URL is server configuration, never supplied
by the browser. Use a private network and keep worker/model secrets out of the
client. See [worker setup](../../ai-worker/docs/development.md).

Connect timeout is 5s, idle timeout 35s, run budget 125s, and MVC timeout 130s.
SSE comments every 5s let a silent run detect browser disconnection and cancel
upstream work. Worker failures after response headers become `RUN_ERROR`;
clients must not infer success from HTTP 200 or an abruptly closed body. A reverse
proxy must forward streaming data without buffering and allow these durations.
