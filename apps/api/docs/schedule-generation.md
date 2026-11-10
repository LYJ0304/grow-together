# Schedule generation and confirmation

Mobile calls `POST /api/v1/todos/generate` with the selected local calendar `date`,
optional instructions, and 1–10 explicit `availableWindows` (start strictly before
end, same-day local times). `maxCandidates` defaults to 5 and is limited to 1–10.
Blank instructions use a general request for manageable shared activities.

The API reads only that user's Todos and child profile in a short read transaction,
then calls the current worker `POST /internal/v1/schedule/generate` outside any DB
transaction. It sends `X-API-Key`, explicit durations/windows, and snake_case child
personalization following the worker's [mapping](../../worker/docs/personalization.md).
No name/account ID is sent in child context. Completed months are calculated for
the requested activity date; negative ages and 49+ months are omitted, never clamped.
The API does not calculate corrected age. Observations remain empty because no
reviewed question catalog exists. With no child profile, the worker remains generic.

The preview contains `date`, time-sorted `candidates` and `unscheduled` proposals.
It contains no saved IDs and writes nothing. The API validates lengths, dates,
count (including unscheduled), unique normalized names, midnight boundaries,
merged windows, conflicts with existing schedules and the whole activity-time
budget before returning it. 5min/10min/15to20min cap the total at 5/10/20 minutes;
flexible/missing preferences add no budget. Existing durations do not consume that
budget. Unscheduled proposals count toward the generated budget but cannot be saved.

## Durations and legacy compatibility

V10 adds nullable `todo.duration_minutes` with a 1–1440 constraint. It preserves
legacy rows as null instead of inventing occupied time. Todo CRUD accepts optional
`durationMinutes`, returns it in responses, and rejects intervals ending after the
same day. PUT omission/null preserves a known stored duration. Existing Java callers
and clients omitting duration continue to work. Generation and confirmation return
409 when that day's existing Todos have unknown durations; the user can edit each
Todo's duration first. The manual mobile editor shows an editable 30-minute default
for new Todos, and leaves unknown legacy durations blank.

## Atomic confirmation and failures

`POST /api/v1/todos/batch` receives the original date and 1–10 selected candidates,
including explicit durations. It locks the owner row shared with Todo create,
update and delete. Profile edits also lock that owner. It rechecks current occupied
time and current personalization budget before appending all rows in one transaction.
It never overwrites or removes existing schedules. Changed conditions/overlap or an
unknown existing duration return 409 with no writes. The API does not require a
preview token; clients already have authenticated Todo creation rights. This is not
an exactly-once or idempotency contract.

Mobile retains inputs/candidates on failure, prevents simultaneous submissions,
and does not automatically retry generation or confirmation. Lost save responses
(network/5xx/invalid success body) disable confirmation until the user inspects the
server's date list; no automatic second batch is sent. Cancellation/date/account
changes cannot apply late generation results to another screen/account. Preview
mode never calls generation or writes. Saved results invalidate only the captured
date's Todo query. Candidates are only saved after an explicit user confirmation.

Status codes: 400 invalid request, 401 unauthenticated, 409 state conflict/unknown
duration, 502 invalid worker output or worker failure, 503 unconfigured/unreachable
worker, 504 worker/model timeout. Raw worker errors/provider details are not returned.
Model requests time out at 30 seconds, API worker reads at 35 seconds (connect 3s),
and mobile generation at 45 seconds. Other mobile requests keep their 15s default.

## Local execution and validation

Set `WORKER_BASE_URL` and the same `AI_WORKER_API_KEY` in API/worker environments.
API `WORKER_CONNECT_TIMEOUT_SECONDS`/`WORKER_READ_TIMEOUT_SECONDS` default to 3/35;
startup rejects values breaking model(30s) < read and connect+read < mobile(45s).
The provider key and model configuration belong only to worker. Docker starts
`uvicorn app.main:app --host 0.0.0.0 --port 8000`; the worker profile exposes the port
only on the Compose network. API remains usable without starting the optional
worker profile and returns 503 for unconfigured generation.

```sh
docker compose --env-file infra/.env -f infra/compose.yaml --profile worker up --build
```

The public OpenAPI contract is `contracts/openapi.yaml`;
worker-generated OpenAPI remains internal. Relevant checks include
`ScheduleControllerTest` (binding/auth), `ScheduleGenerationServiceTest` and
`ScheduleRulesTest` (invalid results), `ScheduleWorkerClientTest` (HTTP contract and
errors), `ScheduleIntegrationTest` (ownership, no write/no transaction during model
call, atomic conflict), and `PostgresScheduleTest` (V9→V10 preservation and concurrent
confirmation serialization). Mobile `tests/schedule-ui.mjs` exercises a 320px layout,
selection, failure preservation, uncertain save inspection and conflict/success.
Actual model quality, real-device keyboard/picker behavior and production deployment
are separate from mocked provider and browser validation.
