# Local development

Requirements: Docker with Compose, Node.js with npm, and OpenSSL for JWT key generation. Java 21 is needed to run the API outside Docker; Python 3.12 and `uv` are needed to run the AI worker outside Docker.

Run commands from the repository root unless a module guide says otherwise.

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

Environment templates: [infra](../.env.example), [API](../../apps/api/.env.example),
[mobile](../../apps/mobile/.env.example), and [AI worker](../../apps/ai-worker/.env.example).
The Compose configuration is in [compose.yaml](../compose.yaml).

## Run an app or job

After the API and PostgreSQL are running, open another terminal and follow the
[mobile development guide](../../apps/mobile/docs/development.md) to start Expo.
For a physical phone, configure the computer's LAN address as described there.

The [API development guide](../../apps/api/docs/development.md) covers running
Java outside Docker, testing, health checks, and Swagger UI.

The [AI worker guide](../../apps/ai-worker/docs/development.md) covers running the
current example job through Compose or locally with uv. The worker is optional
and runs independently from the API.

Each module guide includes its checks. For Render staging deployment, follow the
[API staging guide](../../apps/api/docs/staging/Development.md).
