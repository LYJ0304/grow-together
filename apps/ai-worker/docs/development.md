# AI worker development

The worker runs independent AI jobs and exposes a private AG-UI text-stream
transport. Provider integration (`app/model.py`), AG-UI events (`app/agent.py`),
and HTTP/authentication (`app/server.py`) have separate responsibilities.
The existing example job still runs with `uv run python -m app.main`.

## Counseling stream

From `apps/ai-worker`:

```bash
cp .env.example .env
uv sync --locked
uv run uvicorn app.server:app --host 127.0.0.1 --port 8000
```

Set `WORKER_TOKEN` to the same random secret as the API. Configure
`MODEL_BASE_URL`, `MODEL_API_KEY` and `MODEL_NAME` for your chosen OpenAI-compatible
Chat Completions provider. No model is silently selected. Requests fail with 503
before opening the stream when model credentials/name are absent. The transport
requires `X-Worker-Token`; keep it on a private network. There is no public worker
port in Compose and no production mock switch.

Set `AI_WORKER_URL=http://localhost:8000` for a host API. Compose overrides it to
`http://ai-worker:8000` and starts the HTTP worker with the optional profile:

```bash
docker compose --env-file infra/.env -f infra/compose.yaml --profile worker up --build
```

The default container command remains the example job when invoked outside
Compose. To run the example with Compose, explicitly override its command:

```bash
docker compose --env-file infra/.env -f infra/compose.yaml --profile worker run --rm ai-worker uv run --no-sync python -m app.main
```

The HTTP service currently accepts bounded user/assistant text messages only.
Provider failures are sanitized, truncated provider responses fail rather than
finish successfully, and disconnect cancellation closes the provider stream.
There is a 30s provider read timeout, 5s connect timeout and 120s total run budget.
Secrets and conversation text must not be included in error responses or logs.

## Reproducible local streams without a model key

A test-only OpenAI-compatible server supports normal, delayed, failed and
truncated responses. Start it in another terminal from this directory:

```bash
uv run uvicorn fake_model:app --app-dir tests --host 127.0.0.1 --port 18112
```

Run the worker with explicit **test-only** settings, then configure the API with
the same worker token and worker URL. These example tokens are fixtures, not
production secrets:

```bash
WORKER_TOKEN=issue110-test-only MODEL_BASE_URL=http://127.0.0.1:18112/v1 MODEL_API_KEY=test-only MODEL_NAME=test-model uv run uvicorn app.server:app --host 127.0.0.1 --port 18111
```

Send ordinary text for a successful stream, or the exact messages `느린 응답`,
`오류 응답`, `연결 끊김`, `중단 테스트` to exercise each failure/latency path.
Only the fixture imports this behavior; the production worker has no fake mode.

## Checks

```bash
uv sync --locked
uv run ruff check .
uv run pytest
```

Tests cover event ordering, incremental Korean text, sanitized failures, output
limits, cancellation cleanup, private endpoint auth and a real local HTTP
provider through the SDK. They do not claim live provider credentials or native
client verification.
