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
to `null` and accepts 0–47 inclusive. `interests` and `concerns` default
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
