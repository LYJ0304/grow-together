from .generator import DiaryGenerator
from .schemas import (
    DiaryGenerateRequest,
    DiaryGenerationResponse,
)
from .validator import DiaryValidator


class DiaryService:
    def __init__(
        self,
        generator: DiaryGenerator,
        validator: DiaryValidator,
    ):
        self.generator = generator
        self.validator = validator

    async def generate(
        self,
        request: DiaryGenerateRequest,
    ) -> DiaryGenerationResponse:

        result = await self.generator.generate(request)

        self.validator.validate(request, result)

        return result
