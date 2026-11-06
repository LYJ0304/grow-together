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

## Child profile

Authenticated accounts can store one child profile matching the current Children
screen. All operations use the access JWT to identify the account:

- `GET /api/v1/children/me`: returns the profile, or `404` if none is registered.
- `POST /api/v1/children/me`: registers the first profile and returns `201`.
  If one already exists, returns `409` and preserves the existing profile.
- `PUT /api/v1/children/me`: creates or replaces the profile and returns `200`.

POST and PUT serialize writes for the same account. Concurrent POST requests
result in one registration and a conflict for the other request. PUT retains its
create-or-replace behavior for existing callers.

Request and response use the same two fields:

```json
{"name":"하늘","birthday":"2024-03-15"}
```

Names are trimmed and must contain 1–50 characters. Birthdays use `YYYY-MM-DD`,
must be real dates from year 0001, and cannot be after the server's current date.
The `V7` Flyway migration creates the account-owned profile table. It does not
import profiles already stored in mobile AsyncStorage; the mobile screen still
uses local storage until API integration is implemented.
