from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_schedule_service, verify_service_key
from app.features.schedule.planner import ScheduleGenerationError
from app.features.schedule.schemas import ScheduleGenerationRequest, ScheduleGenerationResponse
from app.features.schedule.service import ScheduleService
from app.features.schedule.validator import ScheduleValidationError
from app.llm.errors import LLMTimeoutError

router = APIRouter(
    prefix="/internal/v1/schedule",
    tags=["schedule"],
    dependencies=[Depends(verify_service_key)],
)


@router.post("/generate", response_model=ScheduleGenerationResponse)
async def generate_schedule(
    request: ScheduleGenerationRequest,
    service: Annotated[ScheduleService, Depends(get_schedule_service)],
) -> ScheduleGenerationResponse:
    try:
        return await service.generate(request)
    except LLMTimeoutError as exc:
        raise HTTPException(status_code=504, detail="AI generation timed out") from exc
    except ScheduleGenerationError as exc:
        raise HTTPException(status_code=502, detail="AI generation failed") from exc
    except ScheduleValidationError as exc:
        raise HTTPException(status_code=502, detail="Invalid AI generation result") from exc
