# Worker development

Runs internal AI jobs independently from the API. Shared worker infrastructure
remains provider- and feature-neutral; diary generation uses an OpenRouter client.

## Run locally

Use Python 3.12 and uv. From `apps/worker`, prepare the environment from the
[template](../.env.example) and run:

```bash
cp .env.example .env
uv sync --locked
uv run python -m app.main
```

The worker reads `SERVICE_NAME` and `LOG_LEVEL` from its local `.env`.
Set `AI_WORKER_API_KEY` for internal service authentication, `OPENROUTER_API_KEY`
for OpenRouter access, and `LLM_DIARY_MODEL` to the model ID used for diary generation.
All three settings are required when importing the application.
Keep `.env` local and never commit secrets.

## Existing local environments

After updating to the renamed worker directory, create a fresh environment with
`uv sync --locked` in `apps/worker`. If you have an environment file in the former
worker directory, review its settings and configure `apps/worker/.env` yourself;
set `SERVICE_NAME=growtogether-worker` unless you need a custom service name.
Keep old local files until you have verified the new setup. Virtual environments
contain absolute paths and should be recreated rather than moved.

The FastAPI application at `app.main:app` registers `POST /internal/v1/diary/generate`,
authenticated with the `X-API-Key` header. Versioned routes live in `app/api/routes/v1/`.
The current command-line entry point
still runs the example job; an HTTP server is not configured.

## Run with Compose

Prepare the environment files using the
[local development guide](../../../infra/docs/local-development.md).
From the repository root:

```bash
docker compose --env-file infra/.env -f infra/compose.yaml --profile worker run --rm worker
```

## Checks

From `apps/worker`:

```bash
uv sync --locked
uv run ruff check .
uv run pytest
```

Tests supply their own credentials and mock outbound HTTP requests. They do not
need a local `.env`, a real OpenRouter API key, or a running HTTP server.
