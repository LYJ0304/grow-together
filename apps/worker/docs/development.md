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
authenticated with the `X-API-Key` header. Routes live in `app/api/routes/`;
the URL prefix carries the API version.
`POST /internal/v1/schedule/generate` uses the same authentication and returns
schedule previews without saving Todos.
`LLM_SCHEDULE_MODEL` optionally selects a separate model for schedule generation;
unset or empty values reuse `LLM_DIARY_MODEL`.
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

## Schedule generation

`features/schedule/service.py` orchestrates Planner → Scheduler → Validator.
The Planner uses `features/schedule/prompts/generation.py` and the common LLM
interface. The current OpenRouter client requests JSON object output; Pydantic
validates the `activities` envelope, activity fields and count locally. Provider
JSON Schema Structured Outputs are not required by this implementation.

The Scheduler merges overlapping/touching available windows and subtracts occupied
intervals. Activities are processed in the Planner's order. An exact preferred
start is used when it fits; otherwise the earliest fitting gap is used. Times are
not rounded to five-minute steps. Activities that cannot fit are returned in
`unscheduled`; the total number of candidates and unscheduled activities cannot
exceed `max_candidates`. The Validator checks dates, windows, overlaps and duplicate
activity names (ignoring case and repeated whitespace), including unscheduled items.

All times are local wall-clock values on the requested date, without UTC offsets.
`TimeWindow` requires `start < end`; overnight windows are rejected. Python `time`
does not represent `24:00`, so window endpoints use `00:00:00` through
`23:59:59.999999`. Existing schedules may end exactly at midnight but cannot extend
into the next day. Every existing schedule requires an explicit `duration_minutes`;
the worker never invents a duration for an existing Todo.

Example request, with the `X-API-Key` header:

```json
{
  "date": "2026-11-07",
  "instructions": "오후에는 아이와 놀고 책을 읽는 일정을 만들어줘",
  "available_windows": [{"start": "13:00:00", "end": "17:00:00"}],
  "existing_schedules": [
    {"todo_id": 12, "plan_name": "점심 식사", "start": "13:00:00", "duration_minutes": 60}
  ],
  "max_candidates": 5
}
```

Responses contain `date`, `candidates` and `unscheduled`. Candidates contain
`plan_name`, nullable `content`, `scheduled_date`, `scheduled_time` and
`duration_minutes`, without a database ID. `unscheduled` retains the proposal
fields, including nullable `preferred_time`. Missing or incorrect service keys
return 401; invalid requests return 422; provider failures or invalid generation
results return 502; upstream HTTP timeouts return 504. Error bodies contain a
public `detail` string, never raw provider output.

Spring remains responsible for ownership checks, reading existing Todos, choosing
an explicit duration policy, and saving only after user confirmation. It must
revalidate candidates against current schedules when saving. Spring/Mobile
integration and Todo duration persistence are outside this worker implementation;
there is no change to the external Spring OpenAPI contract.
