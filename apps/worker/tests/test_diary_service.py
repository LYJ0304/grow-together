import asyncio
from unittest.mock import AsyncMock, Mock

import pytest

from app.features.diary.schemas import DiaryGenerateRequest, DiaryGenerationResponse


def test_service_validates_generated_result_before_returning() -> None:
    from app.features.diary.service import DiaryService

    request = DiaryGenerateRequest.model_validate({"date": "2026-11-07"})
    result = DiaryGenerationResponse(content="일기")
    generator = Mock(generate=AsyncMock(return_value=result))
    validator = Mock()
    validator.validate.side_effect = lambda req, res: generator.generate.assert_awaited_once_with(
        req
    )
    assert asyncio.run(DiaryService(generator, validator).generate(request)) is result
    validator.validate.assert_called_once_with(request, result)


def test_service_does_not_validate_when_generation_fails() -> None:
    from app.features.diary.generator import DiaryGenerationError
    from app.features.diary.service import DiaryService

    generator = Mock(generate=AsyncMock(side_effect=DiaryGenerationError("failed")))
    validator = Mock()
    request = DiaryGenerateRequest.model_validate({"date": "2026-11-07"})
    with pytest.raises(DiaryGenerationError):
        asyncio.run(DiaryService(generator, validator).generate(request))
    validator.validate.assert_not_called()


def test_service_does_not_return_invalid_result() -> None:
    from app.features.diary.service import DiaryService
    from app.features.diary.validator import DiaryValidationError

    generator = Mock(generate=AsyncMock(return_value=DiaryGenerationResponse(content="일기")))
    validator = Mock()
    validator.validate.side_effect = DiaryValidationError("Unknown source IDs")
    request = DiaryGenerateRequest.model_validate({"date": "2026-11-07"})
    with pytest.raises(DiaryValidationError):
        asyncio.run(DiaryService(generator, validator).generate(request))
