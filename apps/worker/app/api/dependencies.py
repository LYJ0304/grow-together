import secrets
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, HTTPException, Security
from fastapi.security import APIKeyHeader

from app.core.config import settings
from app.features.chat.generator import ChatGenerator
from app.features.chat.service import ChatService
from app.features.diary.generator import DiaryGenerator
from app.features.diary.service import DiaryService
from app.features.diary.validator import DiaryValidator
from app.features.schedule.planner import SchedulePlanner
from app.features.schedule.scheduler import ScheduleScheduler
from app.features.schedule.service import ScheduleService
from app.features.schedule.validator import ScheduleValidator
from app.llm.client import OpenRouterClient

api_key_header = APIKeyHeader(
    name="X-API-Key",
    auto_error=False,
)


def verify_service_key(
    api_key: Annotated[str | None, Security(api_key_header)],
) -> None:
    expected_key = settings.ai_worker_api_key.get_secret_value()

    if not expected_key or not api_key:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )

    if not secrets.compare_digest(api_key.encode("utf-8"), expected_key.encode("utf-8")):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )


@lru_cache
def get_llm_client() -> OpenRouterClient:
    return OpenRouterClient(
        api_key=settings.openrouter_api_key.get_secret_value(),
        model=settings.llm_diary_model,
    )


def get_diary_service(
    llm_client: Annotated[
        OpenRouterClient,
        Depends(get_llm_client),
    ],
) -> DiaryService:

    generator = DiaryGenerator(
        llm_client=llm_client,
    )

    validator = DiaryValidator()

    return DiaryService(
        generator=generator,
        validator=validator,
    )


@lru_cache
def get_schedule_llm_client() -> OpenRouterClient:
    return OpenRouterClient(
        api_key=settings.openrouter_api_key.get_secret_value(),
        model=settings.llm_schedule_model or settings.llm_diary_model,
    )


def get_schedule_service(
    llm_client: Annotated[OpenRouterClient, Depends(get_schedule_llm_client)],
) -> ScheduleService:
    return ScheduleService(
        planner=SchedulePlanner(llm_client),
        scheduler=ScheduleScheduler(),
        validator=ScheduleValidator(),
    )


@lru_cache
def get_chat_llm_client() -> OpenRouterClient:
    return OpenRouterClient(
        api_key=settings.openrouter_api_key.get_secret_value(),
        model=settings.llm_chat_model or settings.llm_diary_model,
    )


def get_chat_service(
    llm_client: Annotated[OpenRouterClient, Depends(get_chat_llm_client)],
) -> ChatService:
    return ChatService(generator=ChatGenerator(llm_client))
