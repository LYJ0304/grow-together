from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_chat_service, verify_service_key
from app.features.chat.schemas import (
    ChatGenerateRequest,
    ChatGenerateResponse,
)
from app.features.chat.service import ChatService
from app.llm.errors import LLMError, LLMTimeoutError

router = APIRouter(
    prefix="/internal/v1/chat",
    tags=["chat"],
    dependencies=[Depends(verify_service_key)],
)


@router.post(
    "/generate",
    response_model=ChatGenerateResponse,
)
async def generate_chat(
    request: ChatGenerateRequest,
    service: Annotated[
        ChatService,
        Depends(get_chat_service),
    ],
) -> ChatGenerateResponse:
    try:
        return await service.generate(request)
    except LLMTimeoutError as exc:
        raise HTTPException(status_code=504, detail="AI generation timed out") from exc
    except LLMError as exc:
        raise HTTPException(status_code=502, detail="AI generation failed") from exc
