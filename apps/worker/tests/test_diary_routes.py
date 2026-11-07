from unittest.mock import AsyncMock, Mock

import pytest
from pydantic import SecretStr

from app.features.diary.schemas import DiaryGenerationResponse


@pytest.fixture
def diary_service(worker_app):
    from app.api.dependencies import get_diary_service

    service = Mock(generate=AsyncMock(return_value=DiaryGenerationResponse(content="오늘의 일기")))
    worker_app.dependency_overrides[get_diary_service] = lambda: service
    return service


def test_registered_route_returns_generation(post_diary, diary_service) -> None:
    response = post_diary({"date": "2026-11-07"}, headers={"X-API-Key": "test-worker-key"})
    assert response.status_code == 200
    assert response.json() == {
        "content": "오늘의 일기",
        "emotions": [],
        "growth_points": [],
        "tomorrow_tip": None,
        "source_todo_ids": [],
    }
    diary_service.generate.assert_awaited_once()
    assert diary_service.generate.call_args.args[0].date.isoformat() == "2026-11-07"


def test_openapi_exposes_versioned_diary_endpoint(worker_app) -> None:
    paths = worker_app.openapi()["paths"]
    assert "/internal/v1/diary/generate" in paths
    assert "/internal/diary/generate" not in paths


@pytest.mark.parametrize(
    "headers", [{}, {"X-API-Key": "wrong"}, {"X-API-Key": ""}, {"X-API-Key": b"\xff"}]
)
def test_route_requires_service_key(post_diary, diary_service, headers) -> None:
    response = post_diary({"date": "2026-11-07"}, headers=headers)
    assert response.status_code == 401
    assert response.json() == {"detail": "Unauthorized"}
    diary_service.generate.assert_not_awaited()


def test_route_rejects_empty_configured_key(post_diary, diary_service, monkeypatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "ai_worker_api_key", SecretStr(""))
    response = post_diary({"date": "2026-11-07"}, headers={"X-API-Key": "test-worker-key"})
    assert response.status_code == 401
    diary_service.generate.assert_not_awaited()


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"date": "invalid"},
        {"date": "2026-11-07", "activities": [{"name": ""}]},
        {"date": "2026-11-07", "unexpected": True},
    ],
)
def test_route_rejects_invalid_request(post_diary, diary_service, payload) -> None:
    response = post_diary(payload, headers={"X-API-Key": "test-worker-key"})
    assert response.status_code == 422
    diary_service.generate.assert_not_awaited()


@pytest.mark.parametrize(
    ("error_name", "detail"),
    [
        ("generation", "AI generation failed"),
        ("validation", "Invalid AI generation result"),
    ],
)
def test_route_maps_generation_errors_without_leaking_details(
    post_diary,
    diary_service,
    error_name,
    detail,
) -> None:
    from app.features.diary.generator import DiaryGenerationError
    from app.features.diary.validator import DiaryValidationError

    error_type = DiaryGenerationError if error_name == "generation" else DiaryValidationError
    diary_service.generate.side_effect = error_type("private upstream details")
    response = post_diary({"date": "2026-11-07"}, headers={"X-API-Key": "test-worker-key"})
    assert response.status_code == 502
    assert response.json() == {"detail": detail}


def test_route_runs_real_service_generator_and_validator(worker_app, post_diary) -> None:
    from app.api.dependencies import get_llm_client

    client = Mock(
        complete=AsyncMock(return_value='{"content":"산책을 했다.","source_todo_ids":[1]}')
    )
    worker_app.dependency_overrides[get_llm_client] = lambda: client
    response = post_diary(
        {
            "date": "2026-11-07",
            "activities": [{"todo_id": 1, "name": "산책"}],
        },
        headers={"X-API-Key": "test-worker-key"},
    )
    assert response.status_code == 200
    assert response.json()["source_todo_ids"] == [1]
    client.complete.assert_awaited_once()


def test_route_rejects_hallucinated_sources_through_real_service(worker_app, post_diary) -> None:
    from app.api.dependencies import get_llm_client

    client = Mock(complete=AsyncMock(return_value='{"content":"일기","source_todo_ids":[99]}'))
    worker_app.dependency_overrides[get_llm_client] = lambda: client
    response = post_diary({"date": "2026-11-07"}, headers={"X-API-Key": "test-worker-key"})
    assert response.status_code == 502
    assert response.json() == {"detail": "Invalid AI generation result"}


def test_route_converts_llm_failure_through_real_service(worker_app, post_diary) -> None:
    from app.api.dependencies import get_llm_client
    from app.llm.errors import LLMError

    client = Mock(complete=AsyncMock(side_effect=LLMError("private upstream details")))
    worker_app.dependency_overrides[get_llm_client] = lambda: client
    response = post_diary({"date": "2026-11-07"}, headers={"X-API-Key": "test-worker-key"})
    assert response.status_code == 502
    assert response.json() == {"detail": "AI generation failed"}
