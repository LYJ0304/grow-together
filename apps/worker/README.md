# GrowTogether Worker

Runs internal AI jobs independently from the API.

See the [development guide](docs/development.md) for setup, example job execution,
configuration, and checks.


## Parenting chat context

The internal authenticated endpoint `POST /internal/v1/chat/generate` accepts
an optional request-scoped child profile:

```json
{
  "message": "아이와 어떤 놀이를 하면 좋을까요?",
  "history": [],
  "child_context": {
    "age_months": 18,
    "interests": ["공", "그림책"],
    "concerns": ["잠들기 어려움"]
  }
}
```

Send the configured service key in the `X-API-Key` header. `child_context`
may be omitted or `null`; an empty object also works. `age_months` defaults
to `null` and accepts 0–48 inclusive. `interests` and `concerns` default
to independent empty lists and accept at most 10 strings each. Unknown fields
are rejected, consistent with the other chat request models. Invalid context
returns HTTP 422 before generation.

The server owns the parenting system prompt. Validated context is sent as a
separate user-role JSON background message before history and the current
question; it is not promoted to system instructions. Empty context is omitted,
and missing profile information is not assumed. This prompt separation guides
the model but does not guarantee model compliance or medical accuracy.

This endpoint does not persist profiles or automatically fetch them from the
Spring API. Its FastAPI-generated OpenAPI describes the optional field; the
external Spring API contract in `contracts/openapi.yaml` is unchanged.

## Chat diary context

`POST /internal/v1/chat/generate` also accepts optional caller-supplied diary
excerpts alongside `child_context`:

```json
{
  "message": "요즘 아이가 잠을 잘 못 자는데 어떻게 하면 좋을까요?",
  "history": [],
  "child_context": {"age_months": 18},
  "diary_context": [
    {"diary_id": 42, "content": "낮잠을 늦게 잤고 밤에도 자주 깼다."}
  ]
}
```

Omitting `diary_context` or passing `[]` preserves the existing chat behavior.
The field is an array, not nullable, with at most 5 entries. Each entry requires
`diary_id` (a positive integer, without string/boolean coercion) and `content`
(1–1,000 characters after trimming surrounding whitespace). Unknown entry fields
are rejected. Invalid requests return 422 before generation. Authentication and
502/504 error responses remain unchanged.

Diaries are serialized as a separate user-role JSON background message after
nonempty child context and before history and the current question. Diary text
is reference data, never system instructions. The prompt asks the model to use
relevant recorded observations, identify their source, and avoid inventing dates,
child associations, or a complete history from a limited selection. Prompt
separation does not guarantee model compliance or answer quality.

The caller must select records and verify access before sending them. The worker
does not query the database, validate diary ownership, persist excerpts, or infer
that a diary belongs to the supplied child. No automatic recency selection,
images, attachment URLs, Todo data, search, or summarization is included.
Spring API and mobile integration are separate work; this change alone does not
make saved diaries available automatically. The external Spring OpenAPI contract
is unchanged; the internal request is described by FastAPI-generated OpenAPI.

## Onboarding personalization

Chat and schedule generation accept optional, validated
`child_context.personalization`, separate from legacy free-text concerns. See
[personalization mapping and examples](docs/personalization.md) for #170/#171
field mapping, empty/null semantics, unapproved-observation rejection and the
aggregate 5/10/20-minute schedule budget. Worker support does not yet connect
stored profiles to product chat/schedule requests; Spring integration remains separate.

## Weekly reports

The internal weekly report generator follows the API-owned `weekly-v1`/`weekly-v2` contract.
See [generation, validation, errors and limits](docs/weekly-reports.md).
`LLM_REPORT_MODEL` is optional and falls back to `LLM_DIARY_MODEL`.


### Activity reactions

The API supplies bounded `activity_feedback` to schedule generation: completed,
recorded reactions from the preceding thirty days, at most fifty rows plus
`activity_feedback_truncated`. These are distinct from occupied `existing_schedules`;
unknown historical durations do not block feedback. Only the API queries the DB and
applies ownership and the Asia/Seoul current-time cutoff. The Worker checks IDs,
dates, enums, lengths, duplicates and limits. Missing feedback preserves the previous
planner payload and behavior. Reactions are per-activity caregiver observations,
not a persistent preference, diagnosis, score, or reason to force repetition.

Weekly reports use `weekly-v2` and optional `sources.todos[].child_reaction`.
The Worker continues to accept `weekly-v1` without recorded reactions and keeps
that model payload/prompt unchanged. Upgrade the Worker before the API sends the
new fields/version. No model training, Mobile changes or new DB columns are needed.
