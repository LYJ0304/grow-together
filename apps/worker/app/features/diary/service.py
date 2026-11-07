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

        # 1. LLM으로 일기 초안 생성
        result = await self.generator.generate(request)

        # 2. 생성된 결과 검증
        self.validator.validate(request, result)

        # 3. 검증된 결과 반환
        return result
