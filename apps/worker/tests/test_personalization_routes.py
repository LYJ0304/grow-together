import asyncio
import json
from unittest.mock import AsyncMock, Mock

import httpx
import pytest


@pytest.fixture
def generation_client(worker_app):
    from app.api.dependencies import get_chat_llm_client, get_schedule_llm_client

    client = Mock(
        model="test/model",
        complete_chat=AsyncMock(return_value="답변"),
        complete=AsyncMock(
            return_value='{"activities":[{"plan_name":"독서","duration_minutes":5}]}'
        ),
    )
    worker_app.dependency_overrides[get_chat_llm_client] = lambda: client
    worker_app.dependency_overrides[get_schedule_llm_client] = lambda: client
    return client


def post(worker_app, kind, context, key="test-worker-key"):
    payload = (
        {"message": "질문"}
        if kind == "chat"
        else {
            "date": "2026-11-10",
            "instructions": "아이와 놀기",
            "available_windows": [{"start": "09:00", "end": "10:00"}],
        }
    )
    payload["child_context"] = context

    async def send():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=worker_app),
            base_url="http://test",
        ) as client:
            return await client.post(
                f"/internal/v1/{kind}/generate",
                json=payload,
                headers={"X-API-Key": key},
            )

    return asyncio.run(send())


@pytest.mark.parametrize("kind", ["chat", "schedule"])
def test_full_workflow_accepts_personalization(worker_app, generation_client, kind):
    response = post(
        worker_app,
        kind,
        {
            "age_months": 48,
            "personalization": {
                "concern_codes": ["sleep"],
                "available_activity_time": "5min",
                "prematurity_status": "unknown",
            },
        },
    )
    assert response.status_code == 200
    if kind == "chat":
        messages = generation_client.complete_chat.call_args.kwargs["messages"]
        assert json.loads(messages[1]["content"])["child_context"]["personalization"][
            "concern_labels"
        ] == ["수면"]
        generation_client.complete.assert_not_awaited()
    else:
        assert response.json()["candidates"][0]["duration_minutes"] == 5
        generation_client.complete_chat.assert_not_awaited()


@pytest.mark.parametrize("kind", ["chat", "schedule"])
@pytest.mark.parametrize(
    "context",
    [
        {"age_months": 49},
        {"personalization": {"concern_codes": ["none", "sleep"]}},
        {
            "personalization": {
                "development_observations": [{"question_id": "fake", "answer": "yes"}]
            }
        },
        {"personalization": {"prematurity_status": "yes", "expected_due_date": "2024-01-01"}},
    ],
)
def test_http_422_does_not_call_model(worker_app, generation_client, kind, context):
    assert post(worker_app, kind, context).status_code == 422
    generation_client.complete.assert_not_awaited()
    generation_client.complete_chat.assert_not_awaited()


@pytest.mark.parametrize("kind", ["chat", "schedule"])
def test_personalization_still_requires_service_auth(worker_app, generation_client, kind):
    assert post(worker_app, kind, {"age_months": 48}, key="wrong").status_code == 401
    generation_client.complete.assert_not_awaited()
    generation_client.complete_chat.assert_not_awaited()


def test_over_budget_generation_is_502_not_trimmed(worker_app, generation_client):
    generation_client.complete.return_value = json.dumps(
        {
            "activities": [
                {"plan_name": "책 읽기", "duration_minutes": 3},
                {"plan_name": "함께 대화", "duration_minutes": 3},
            ]
        }
    )
    response = post(
        worker_app, "schedule", {"personalization": {"available_activity_time": "5min"}}
    )
    assert response.status_code == 502
    assert response.json() == {"detail": "AI generation failed"}
    assert "candidates" not in response.json()


@pytest.mark.parametrize("kind", ["chat", "schedule"])
@pytest.mark.parametrize("error,status", [("provider", 502), ("timeout", 504)])
def test_personalized_generation_preserves_error_mapping(
    worker_app, generation_client, kind, error, status
):
    from app.llm.errors import LLMError, LLMTimeoutError

    method = generation_client.complete_chat if kind == "chat" else generation_client.complete
    method.side_effect = LLMTimeoutError("private") if error == "timeout" else LLMError("private")
    response = post(worker_app, kind, {"personalization": {"concern_codes": ["sleep"]}})
    assert response.status_code == status
    assert "private" not in response.text


def test_openapi_exposes_shared_context_and_all_references_resolve(worker_app):
    spec = worker_app.openapi()
    schemas = spec["components"]["schemas"]
    for request_name in ["ChatGenerateRequest", "ScheduleGenerationRequest"]:
        assert {"$ref": "#/components/schemas/ChildContext"} in schemas[request_name]["properties"][
            "child_context"
        ]["anyOf"]
    assert schemas["ChildContext"]["properties"]["age_months"]["anyOf"][0]["maximum"] == 48
    personal = schemas["PersonalizationContext"]["properties"]
    assert personal["concern_codes"]["maxItems"] == 2
    assert personal["development_observations"]["maxItems"] == 5
    assert "only an empty array" in personal["development_observations"]["description"]
    assert schemas["DevelopmentObservation"]["properties"]["answer"]["enum"] == [
        "yes",
        "not_yet",
        "unknown",
    ]

    def check(node):
        if isinstance(node, dict):
            if "$ref" in node:
                target = spec
                assert node["$ref"].startswith("#/")
                for part in node["$ref"][2:].split("/"):
                    target = target[part.replace("~1", "/").replace("~0", "~")]
            for value in node.values():
                check(value)
        elif isinstance(node, list):
            for value in node:
                check(value)

    check(spec)
