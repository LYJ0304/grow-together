# AI worker development

Runs internal AI jobs independently from the API. The worker is provider- and
feature-neutral; it currently executes only an example job.

## Run locally

Use Python 3.12 and uv. From `apps/ai-worker`, prepare the environment from the
[template](../.env.example) and run:

```bash
cp .env.example .env
uv sync --locked
uv run python -m app.main
```

The worker reads `SERVICE_NAME` and `LOG_LEVEL` from its local `.env`.
Keep `.env` local and never commit secrets.

## Run with Compose

Prepare the environment files using the
[local development guide](../../../infra/docs/local-development.md).
From the repository root:

```bash
docker compose --env-file infra/.env -f infra/compose.yaml --profile worker run --rm ai-worker
```

## Checks

From `apps/ai-worker`:

```bash
uv sync --locked
uv run ruff check .
uv run pytest
```
