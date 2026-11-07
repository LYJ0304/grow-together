import asyncio
import json
from unittest.mock import AsyncMock, Mock

import httpx
import pytest
from pydantic import SecretStr

from app.features.schedule.schemas import ScheduleGenerationResponse


@pytest.fixture
def post_schedule(worker_app):
    def post(payload, *, headers=None):
        async def send():
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=worker_app),
                base_url="http://test",
            ) as client:
                return await client.post(
                    "/internal/v1/schedule/generate", json=payload, headers=headers
                )

        return asyncio.run(send())

    return post


@pytest.fixture
def schedule_client(worker_app):
    from app.api.dependencies import get_schedule_llm_client

    client = Mock(
        complete=AsyncMock(
            return_value=json.dumps(
                {
                    "activities": [
                        {"plan_name": "독서", "duration_minutes": 30},
                        {"plan_name": "외출", "duration_minutes": 1440},
                    ]
                }
            )
        )
    )
    worker_app.dependency_overrides[get_schedule_llm_client] = lambda: client
    return client


@pytest.fixture
def schedule_service(worker_app, schedule_request):
    from app.api.dependencies import get_schedule_service

    service = Mock(
        generate=AsyncMock(
            return_value=ScheduleGenerationResponse(
                date=schedule_request.date,
                candidates=[],
            )
        )
    )
    worker_app.dependency_overrides[get_schedule_service] = lambda: service
    return service


def test_real_workflow_returns_preview_without_ids(
    post_schedule,
    schedule_client,
    schedule_payload,
    worker_app,
):
    schedule_payload["existing_schedules"] = [
        {"todo_id": 12, "plan_name": "식사", "start": "13:00", "duration_minutes": 60}
    ]
    response = post_schedule(schedule_payload, headers={"X-API-Key": "test-worker-key"})
    assert response.status_code == 200
    result = response.json()
    assert result["date"] == "2026-11-07"
    assert result["candidates"] == [
        {
            "plan_name": "독서",
            "content": None,
            "scheduled_date": "2026-11-07",
            "scheduled_time": "14:00:00",
            "duration_minutes": 30,
        }
    ]
    assert result["unscheduled"][0]["plan_name"] == "외출"
    schedule_client.complete.assert_awaited_once()
    assert "/internal/v1/schedule/generate" in worker_app.openapi()["paths"]


@pytest.mark.parametrize(
    "headers", [{}, {"X-API-Key": "wrong"}, {"X-API-Key": ""}, {"X-API-Key": b"\xff"}]
)
def test_schedule_requires_auth(post_schedule, schedule_service, schedule_payload, headers):
    response = post_schedule(schedule_payload, headers=headers)
    assert response.status_code == 401
    assert response.json() == {"detail": "Unauthorized"}
    schedule_service.generate.assert_not_awaited()


@pytest.mark.parametrize(
    "changes",
    [
        {"date": "invalid"},
        {"unexpected": True},
        {"instructions": ""},
        {"available_windows": []},
        {"available_windows": [{"start": "13:00", "end": "17:00Z"}]},
        {"existing_schedules": [{"todo_id": 1, "plan_name": "식사", "start": "13:00"}]},
    ],
)
def test_schedule_rejects_invalid_request(
    post_schedule,
    schedule_service,
    schedule_payload,
    changes,
):
    response = post_schedule(schedule_payload | changes, headers={"X-API-Key": "test-worker-key"})
    assert response.status_code == 422
    schedule_service.generate.assert_not_awaited()


@pytest.mark.parametrize(
    "kind,status,detail",
    [
        ("provider", 502, "AI generation failed"),
        ("malformed", 502, "AI generation failed"),
        ("duplicate", 502, "Invalid AI generation result"),
        ("timeout", 504, "AI generation timed out"),
    ],
)
def test_schedule_maps_errors_without_leaking_provider_details(
    post_schedule,
    schedule_client,
    schedule_payload,
    kind,
    status,
    detail,
):
    from app.llm.errors import LLMError, LLMTimeoutError

    if kind == "provider":
        schedule_client.complete.side_effect = LLMError("private upstream details")
    elif kind == "timeout":
        schedule_client.complete.side_effect = LLMTimeoutError("private upstream details")
    elif kind == "malformed":
        schedule_client.complete.return_value = "private upstream details"
    else:
        schedule_client.complete.return_value = json.dumps(
            {"activities": [{"plan_name": "독서", "duration_minutes": 30}] * 2}
        )
    response = post_schedule(schedule_payload, headers={"X-API-Key": "test-worker-key"})
    assert response.status_code == status
    assert response.json() == {"detail": detail}


def test_schedule_dependency_uses_separate_model(worker_environment, monkeypatch):
    from app.api.dependencies import get_schedule_llm_client
    from app.core.config import settings

    monkeypatch.setattr(settings, "llm_schedule_model", "schedule/model")
    get_schedule_llm_client.cache_clear()
    try:
        assert get_schedule_llm_client().model == "schedule/model"
    finally:
        get_schedule_llm_client.cache_clear()


def test_schedule_model_falls_back_to_diary(worker_environment, monkeypatch):
    from app.api.dependencies import get_schedule_llm_client
    from app.core.config import settings

    monkeypatch.setattr(settings, "llm_schedule_model", None)
    monkeypatch.setattr(settings, "llm_diary_model", "diary/model")
    get_schedule_llm_client.cache_clear()
    try:
        assert get_schedule_llm_client().model == "diary/model"
    finally:
        get_schedule_llm_client.cache_clear()


def test_registered_route_passes_request_to_service(
    post_schedule,
    schedule_service,
    schedule_payload,
    schedule_request,
) -> None:
    response = post_schedule(schedule_payload, headers={"X-API-Key": "test-worker-key"})
    assert response.status_code == 200
    assert response.json() == {"date": "2026-11-07", "candidates": [], "unscheduled": []}
    schedule_service.generate.assert_awaited_once_with(schedule_request)


def test_route_rejects_empty_configured_key(
    post_schedule,
    schedule_service,
    schedule_payload,
    monkeypatch,
) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "ai_worker_api_key", SecretStr(""))
    response = post_schedule(schedule_payload, headers={"X-API-Key": "test-worker-key"})
    assert response.status_code == 401
    assert response.json() == {"detail": "Unauthorized"}
    schedule_service.generate.assert_not_awaited()


def test_route_rejects_missing_fields(post_schedule, schedule_service) -> None:
    response = post_schedule({}, headers={"X-API-Key": "test-worker-key"})
    assert response.status_code == 422
    schedule_service.generate.assert_not_awaited()


def test_openapi_exposes_versioned_schedule_endpoint(worker_app) -> None:
    paths = worker_app.openapi()["paths"]
    assert "/internal/v1/schedule/generate" in paths
    assert "/internal/schedule/generate" not in paths
