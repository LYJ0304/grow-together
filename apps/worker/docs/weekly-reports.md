# Weekly report generation

`POST /internal/v1/reports/weekly/generate` is service-only and requires the existing
`X-API-Key` / `AI_WORKER_API_KEY`. No user authentication, database lookup, ownership
check, persistence, source selection or metric calculation occurs in the Worker.
The Spring API is responsible for these, including child profile availability.
No mobile or external Spring API contract changes are required.

## Contract and generation

The API-owned [weekly-v1 schema](../../../contracts/weekly-report-worker.schema.json)
and [request/response fixtures](../../../contracts/fixtures/reports/) are the wire
contract. Fixtures are consumed directly by Worker tests. Requests and responses
use snake_case (including `next_steps`); all nested unknown fields are forbidden.
Null fields are required where the contract declares them nullable. Names,
birthdays, photo URLs and owner identifiers are not request fields.

The request includes an opaque `source_hash`, `prompt_version: weekly-v1`, a
Monday–Sunday period, API metrics, minimal child context (age zero through
seventy-two months, concerns, available time) and bounded sources. Calendar checks
use Asia/Seoul. Completed samples contain at most fifty Todos; daily metrics still
cover the full week. `todos_truncated` identifies a larger completed population.
Diary samples contain only nonblank excerpts, whereas `diary_days` may also count
blank diary records. Source IDs must be unique within their type, not globally.
The Worker validates these relationships but never returns recalculated metrics.

A single `LLMClient.complete` call receives the request as untrusted JSON data,
separate from the system prompt. The prompt requests a neutral short summary in
two or three sentences, one to three observations and one or two modest activity
suggestions. Observations must quote a cited title/excerpt exactly; next steps
cite the supplied evidence. TODO-only and diary-only inputs are supported. The
Worker wraps validated model results with the input hash/version itself.
`LLM_REPORT_MODEL` optionally selects a report model; absent/empty values reuse
`LLM_DIARY_MODEL`. Existing provider credentials and client are reused.

The validator version is `weekly-validation-v1` (internal, not a new wire field).
It rejects invalid/duplicate evidence, observations not matching a cited original,
all Unicode numeric characters and the API's conservative diagnostic/evaluative
term list in every generated string. This matches the API's independent checks.
Statistics remain exclusively API-controlled. Model JSON must match all length
and array limits; malformed JSON, duplicate keys, code fences and extra fields
are rejected without repair or retry. Output is bounded to thirty-two KiB,
including the response envelope. Request bodies are capped at sixty-four KiB
before JSON parsing, including chunked requests; other routes are unaffected.

## Failure behavior

| Status | Meaning |
| --- | --- |
| 401 | Missing/incorrect service key |
| 413 | Report request body exceeds the byte limit |
| 422 | Invalid request, inconsistent metrics/dates or no source evidence |
| 502 | Provider unavailable, malformed model output or rejected generation |
| 504 | Provider timeout or outer generation deadline exceeded |

No evidence means no LLM call and no successful empty/fictional report. The API
normally gates this case before calling. Generation has a thirty-second outer
deadline in addition to the existing provider timeout and no automatic retry.
Errors use fixed public messages; request validation does not echo private input.
The implementation adds no logging of prompts, excerpts, provider output or keys.

## Validation and limits

Run `uv sync --locked`, `uv run ruff check .`, and `uv run pytest` in `apps/worker`.
Tests cover shared fixtures, dates/counts/samples, source validation, malformed and
unsafe outputs, auth, real service/generator routing with a fake LLM transport,
DI/model selection, request limits, deadline cancellation and HTTP startup.
These tests do not call a live provider or demonstrate model quality.

Exact quotation and deterministic policy checks are deliberately conservative.
A record containing only disallowed numbers or diagnostic terms may have no safe
observation: the generation is rejected rather than paraphrased into a fabricated
fact. An exact quote may still be misleading; evidence membership does not prove
that a summary/recommendation is semantically entailed. Prompt separation and term
filters cannot guarantee resistance to all prompt injection or unsupported claims.
Live-model Korean quality, safety evaluation and provider latency need separate
credentialed evaluation before relying on output quality in production.
