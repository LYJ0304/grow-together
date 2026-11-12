from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute

from app.api.dependencies import get_report_service, verify_service_key
from app.features.report.schemas import ReportRequest, ReportResponse
from app.features.report.service import ReportService
from app.features.report.validator import ReportValidationError
from app.llm.errors import LLMError, LLMTimeoutError


class ReportRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def handle(request: Request):
            try:
                return await handler(request)
            except RequestValidationError as exc:
                # Do not echo sensitive excerpts through standard validation details.
                raise HTTPException(422, "Invalid weekly report request") from exc

        return handle


router = APIRouter(
    prefix="/internal/v1/reports/weekly",
    tags=["reports"],
    dependencies=[Depends(verify_service_key)],
    route_class=ReportRoute,
)


@router.post("/generate", response_model=ReportResponse)
async def generate_weekly_report(
    request: ReportRequest,
    service: Annotated[ReportService, Depends(get_report_service)],
) -> ReportResponse:
    try:
        return await service.generate(request)
    except (LLMTimeoutError, TimeoutError) as exc:
        raise HTTPException(504, "AI generation timed out") from exc
    except ReportValidationError as exc:
        raise HTTPException(502, "Invalid AI generation result") from exc
    except LLMError as exc:
        raise HTTPException(502, "AI generation failed") from exc
