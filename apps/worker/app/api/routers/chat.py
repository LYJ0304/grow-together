from typing import Annotated
from fastapi import APIRouter, Depends, HttpException
from app.api.dependencies import (
    verify_service_key
)
from app.features.chat.schemas import (
    ChatGenerateRequest,
    ChatGenerateResponse,
)

router = APIRouter(
    prefix="/internal/v1/chat",
    tags=["chat"],
    dependencies=[Depends(verify_service_key)],
)

@router.post(
    "/generate",
    response_model=ChatResponse,
)
async def generate_chat(
    request: ChatGenerateRequest,
    service: Annotated[
        ChatService,
        Depends(get_chat_service),
    ],
) -> ChatGenerateResponse:
    return await service.generate(request)