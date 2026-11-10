# Child onboarding personalization

The existing POST/GET/PUT `/api/v1/children/me` endpoints now accept/return
optional onboarding choices. There is still one child profile per account and
ownership is exclusively derived from the JWT. No new endpoints or AI calls
are introduced. Mobile integration belongs to #171; worker context use to #172.

```json
{
  "name": "하늘",
  "birthday": "2024-03-15",
  "personalization": {
    "prematurityStatus": "yes",
    "expectedDueDate": "2024-04-15",
    "concerns": ["sleep", "communication"],
    "availableActivityTime": "10min",
    "developmentObservations": []
  }
}
```

## Replacement and compatibility

- Name and birthday remain the only required inputs. Existing birthday/name
  validation and trimming, POST 409, PUT upsert and owner locking remain intact.
- Omitted or top-level null `personalization` preserves existing choices on PUT;
  it means empty/default choices on a new POST/PUT profile.
- An explicit object **replaces all choices**. `{}` clears personalization.
  Missing/null inner arrays become `[]`; missing/null scalar fields become null.
  Unknown fields inside personalization are rejected to avoid false save success.
- GET and save responses always contain a normalized personalization object.
  Old profiles read as null scalar fields and empty arrays. Existing callers
  can continue sending only name/birthday without deleting new data.
- If a basic-only birthday change would invalidate a stored expected due date,
  return 400 before mutation. Submit an explicit valid replacement to clear or
  correct it. Invalid requests never partially change existing profile data.

## Validation and data meaning

`prematurityStatus` is `yes`, `no`, `unknown`, or null (unanswered). An expected
due date requires yes and must be a real date in years 0001–9999 strictly after
birthday. It may still be in the future; yes does not require a due date.

Concerns are ordered, unique, and limited to two: `sleep`, `feeding`,
`emotion_expression`, `communication`, `developmental_play`, `daily_habits`,
`separation_anxiety`, `none`. `none` is exclusive; an empty list means skipped.
Uniqueness/exclusivity is checked before mutation under the existing owner lock.
The order is persisted independently of the labels.

Activity time is `5min`, `10min`, `15to20min`, `flexible`, or null. It is a stated
family preference, not an automatically generated schedule or completed routine.

No development question catalog has been source-reviewed. Therefore observations
must currently be empty/null; all nonempty arrays and unknown IDs return 400.
The typed answer shape is `questionId` and `answer` (`yes`, `not_yet`, `unknown`),
but the effective current OpenAPI array limit is zero. There are no fabricated
milestones, catalog entries, observation rows, scores or diagnoses. A future
catalog must bind IDs/versions to reviewed sources, domains, applicable month
ranges and age basis before raising this limit (at most five) or storing answers.
Dates/status are stored as reported. Corrected age is not computed. The mobile
0–48-month content scope is not a new restriction on stored birthday values.

Possible future routine-domain mappings (not computed/stored as recommendations):
sleep/emotion_expression/separation_anxiety can inform emotional stability;
feeding/daily_habits can inform everyday habits; communication/developmental_play
can inform developmental play. These are contextual categories, not clinical
scores or fixed assessments of a child's development.

## Persistence and rollout

V9 adds nullable scalar columns plus an ordered child-profile concern table.
Existing names/birthdays/user ownership are unchanged. The concern table has an
owner FK with cascade deletion and at most two positions; no unapproved
observation data is stored. Calendar dates use direct LocalDate JDBC mappings.
Deploy this API before enabling optional-field collection/save in mobile. An
older API can ignore unknown fields, so a 200 alone does not prove those fields
were saved. Verify the returned normalized values before claiming completion.
No deployment, multi-child migration, mobile UI or worker behavior is included.
