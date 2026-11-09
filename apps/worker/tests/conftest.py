import asyncio

import httpx
import pytest
from pydantic import SecretStr


@pytest.fixture
def worker_environment(monkeypatch):
    monkeypatch.setenv("AI_WORKER_API_KEY", "test-worker-key")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-router-key")
    monkeypatch.setenv("LLM_DIARY_MODEL", "test/model")
    monkeypatch.setenv("LLM_CHAT_MODEL", "test/chat")


@pytest.fixture
def worker_app(monkeypatch, worker_environment):
    from app.api.dependencies import get_llm_client, get_schedule_llm_client
    from app.core.config import settings
    from app.main import app

    monkeypatch.setattr(settings, "ai_worker_api_key", SecretStr("test-worker-key"))
    monkeypatch.setattr(settings, "openrouter_api_key", SecretStr("test-router-key"))
    monkeypatch.setattr(settings, "llm_diary_model", "test/model")
    previous_overrides = app.dependency_overrides.copy()
    get_llm_client.cache_clear()
    get_schedule_llm_client.cache_clear()
    try:
        yield app
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        get_llm_client.cache_clear()
        get_schedule_llm_client.cache_clear()


@pytest.fixture
def post_diary(worker_app):
    def post(payload, *, headers=None):
        async def send():
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=worker_app),
                base_url="http://test",
            ) as client:
                return await client.post(
                    "/internal/v1/diary/generate", json=payload, headers=headers
                )

        return asyncio.run(send())

    return post


@pytest.fixture
def schedule_payload():
    return {
        "date": "2026-11-07",
        "instructions": "아이와 놀고 책 읽기",
        "available_windows": [{"start": "13:00", "end": "17:00"}],
    }


@pytest.fixture
def schedule_request(schedule_payload):
    from app.features.schedule.schemas import ScheduleGenerationRequest

    return ScheduleGenerationRequest.model_validate(schedule_payload)
