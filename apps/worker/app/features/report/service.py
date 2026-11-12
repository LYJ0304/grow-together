from .generator import MAX_RESPONSE_BYTES, ReportGenerator
from .schemas import ReportRequest, ReportResponse
from .validator import ReportValidationError, ReportValidator


class ReportService:
    def __init__(self, generator: ReportGenerator, validator: ReportValidator):
        self.generator = generator
        self.validator = validator

    async def generate(self, request: ReportRequest) -> ReportResponse:
        result = await self.generator.generate(request)
        response = ReportResponse(
            source_hash=request.source_hash, prompt_version=request.prompt_version, result=result
        )
        self.validator.validate(request, response)
        if len(response.model_dump_json().encode("utf-8")) > MAX_RESPONSE_BYTES:
            raise ReportValidationError("Oversized report response")
        return response
