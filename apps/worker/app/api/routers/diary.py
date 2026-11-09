from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import (
    get_diary_service,
    verify_service_key,
)
from app.features.diary.generator import DiaryGenerationError
from app.features.diary.schemas import (
    DiaryGenerateRequest,
    DiaryGenerationResponse,
)
from app.features.diary.service import DiaryService
from app.features.diary.validator import DiaryValidationError

router = APIRouter(
    prefix="/internal/v1/diary",
    tags=["diary"],
    dependencies=[Depends(verify_service_key)],
)


@router.post(
    "/generate",
    response_model=DiaryGenerationResponse,
    status_code=200,
)
async def generate_diary(
    request: DiaryGenerateRequest,
    service: Annotated[DiaryService, Depends(get_diary_service)],
) -> DiaryGenerationResponse:

    try:
        return await service.generate(request)

    except DiaryValidationError as exc:
        raise HTTPException(
            status_code=502,
            detail="Invalid AI generation result",
        ) from exc

    except DiaryGenerationError as exc:
        raise HTTPException(
            status_code=502,
            detail="AI generation failed",
        ) from exc
