# Onboarding personalization in worker requests

Both `POST /internal/v1/chat/generate` and
`POST /internal/v1/schedule/generate` accept optional `child_context` with an
optional nested `personalization` object. This is request-scoped background;
the worker never loads a stored profile, checks account ownership or persists it.
The internal schema is FastAPI-generated OpenAPI. The public Spring contract in
`contracts/openapi.yaml` is unchanged.

As of #172 there is no Spring chat/schedule worker caller. #170/#173 store the
profile and #171/#174 collect it; they do not automatically send it to the worker.
A future authenticated Spring caller must read only the requesting user's profile,
map it as below, and select authorized diary excerpts. No new endpoint or placeholder
API client is introduced here. Worker support is distinct from product integration.

## Mapping from the stored profile

| API response | Worker child context | Meaning |
| --- | --- | --- |
| `birthday` | `age_months` computed by the caller | Completed calendar months on the caller's local reference date; 0–48 inclusive |
| `personalization.prematurityStatus` | `personalization.prematurity_status` | `yes`, `no`, `unknown`, or null |
| `birthday` | `personalization.birthday` | Original `YYYY-MM-DD`; send when needed to validate a due date |
| `personalization.expectedDueDate` | `personalization.expected_due_date` | Original date, not corrected age |
| `personalization.concerns` | `personalization.concern_codes` | Stable codes, not legacy free text |
| `personalization.availableActivityTime` | `personalization.available_activity_time` | Daily time together, not a per-activity minimum |
| `personalization.developmentObservations[].questionId` | `personalization.development_observations[].question_id` | Currently unsupported: no approved question IDs |
| `personalization.developmentObservations[].answer` | `personalization.development_observations[].answer` | Reserved `yes`, `not_yet`, `unknown`; currently only an empty list is accepted |

Do not send the child's name, account ID, unrelated health records or unneeded
profile fields. Existing free-text `child_context.interests` and
`child_context.concerns` remain independent lists (at most ten strings each).
Do not relabel the old concerns field as an enum or copy stable codes there.
Only actual supplied values are used; no field implies a complete profile/history.

A caller must not clamp 49+ months to 48. For an out-of-range profile, omit
`age_months` and developmental observations, and use general support without
age-specific milestones. `age_months: 49` is rejected. The worker does not calculate
corrected age or invent an application cutoff. Original birthday/due dates are
preserved as calendar dates; a due date requires `prematurity_status: yes`, the
original birthday, and a date strictly later than that birthday. A future due date
is allowed. These inputs are background, never a diagnostic result.

## Defaults and validation

- `child_context` and `personalization` may be omitted, null or `{}`. Empty optional
  context is omitted from LLM messages. Old requests retain their behavior;
  schedules without meaningful context retain the original system prompt.
- Nullable scalar fields default to null. `concern_codes` and
  `development_observations` default to independent empty lists, but cannot be null.
- Concern codes are `sleep`, `feeding`, `emotion_expression`, `communication`,
  `developmental_play`, `daily_habits`, `separation_anxiety`, `none`. At most two,
  no duplicates; `none` is exclusive. `[]` means unanswered; `["none"]` is an
  explicit no-particular-concern selection.
- Activity time is `5min`, `10min`, `15to20min`, `flexible` or null.
- Observation entries have a nonempty question ID (at most 100 characters) and
  an answer enum, at most five entries and no duplicate IDs. **All nonempty lists
  are currently rejected**, matching the API/mobile's empty reviewed catalog.
  A caller cannot mark an arbitrary question/source as approved. Unknown fields
  are rejected. A future activation must align reviewed question ID/version,
  domain, precise applicable months/age basis and source metadata across the
  API, mobile and worker before accepting answers. `not_yet` must never become
  a developmental-delay label or diagnosis; old observations are not current facts.
- Invalid requests return 422 before the model is called. Service authentication
  still requires `X-API-Key` (401 otherwise). Provider errors/invalid results return
  502 and timeouts 504; responses never expose raw provider errors.

## What reaches the model

The server adds Korean `concern_labels` and deduplicated `support_areas` from the
validated codes. Callers cannot supply those derived fields. The mapping is only
an aid to choosing support, never a medical classification:

| Codes | Labels | Broad support area |
| --- | --- | --- |
| `sleep`, `feeding`, `daily_habits` | 수면, 식사, 생활 습관 | 생활 습관 |
| `emotion_expression`, `separation_anxiety` | 감정 표현, 분리불안 | 정서 안정 |
| `communication`, `developmental_play` | 언어와 소통, 발달 놀이 | 발달 자극 |
| `none` | 특별한 고민 없음 | None |

Chat sends one server-owned system message, then nonempty child/personalization
JSON as a user background message, then supplied diary JSON, then unchanged
history and the current question. It preserves request data and history order.
Unknown/missing facts are not inferred. Data cannot change system instructions.

Schedule sends the same validated/labelled child background in its JSON user
payload. Its additional system guidance applies only with meaningful context.
It uses provided age/concerns/time preferences to suggest manageable activities,
without inventing observations, corrected age, diagnoses or a stored routine.
Prompt separation is not proof of model compliance, answer quality or medical accuracy.

## Schedule time budget

`5min` = 5, `10min` = 10, `15to20min` = **at most 20** minutes in total across
**all new proposals**. There is no 15-minute minimum. `flexible`, null or missing
time means no added budget. Existing schedule durations are never charged to this
budget, modified or deleted. Existing window, overlap, duplicate and
`max_candidates` checks still apply.

The Planner receives a server-derived `activity_budget_minutes` when applicable
and validates the complete generated proposal list. The service checks it again
before scheduling, so a scheduler count limit cannot hide excess proposals.
The Validator also checks the sum of candidates **plus unscheduled** proposals.
Excess is rejected, never silently trimmed or saved. A Planner budget failure
returns `502 {"detail":"AI generation failed"}`; an invalid result caught by the
Validator returns `502 {"detail":"Invalid AI generation result"}`.

The response remains a preview. The caller must revalidate current schedules,
obtain user confirmation and save only selected candidates. The worker never
writes Todos or claims that a routine has been saved.

## Example internal requests

Send a service key through `X-API-Key`. For chat:

```json
{
  "message": "아이와 부담 없이 할 놀이를 알려주세요",
  "history": [],
  "child_context": {
    "age_months": 18,
    "concerns": ["잠들 때 힘들어해요"],
    "personalization": {
      "prematurity_status": "unknown",
      "concern_codes": ["sleep", "communication"],
      "available_activity_time": "10min",
      "development_observations": []
    }
  },
  "diary_context": [{"diary_id": 42, "content": "어제 잠들기 전에 함께 책을 읽었다."}]
}
```

For schedule, reuse the same `child_context` shape alongside existing scheduling
fields (this small complete request has a five-minute total budget):

```json
{
  "date": "2026-11-10",
  "instructions": "아이와 그림책을 보고 대화하기",
  "available_windows": [{"start": "13:00", "end": "14:00"}],
  "existing_schedules": [],
  "max_candidates": 2,
  "child_context": {
    "age_months": 18,
    "personalization": {
      "concern_codes": ["communication"],
      "available_activity_time": "5min"
    }
  }
}
```

The caller does not send `activity_budget_minutes`, labels or support areas;
those are derived locally. Tests cover schema boundaries, serialization/order,
input immutability, aggregate budget/unscheduled handling and the real ASGI workflow
with mocked model calls. They also resolve every generated OpenAPI `$ref`.
No real model call or recommendation-quality evaluation is part of those tests.
