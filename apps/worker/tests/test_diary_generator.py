import asyncio
import json
from unittest.mock import AsyncMock

import pytest

from app.features.diary.schemas import DiaryGenerateRequest


def test_generator_passes_request_and_parses_response() -> None:
    from app.features.diary.generator import DiaryGenerator
    from app.features.diary.prompts.generation import SYSTEM_PROMPT

    client = AsyncMock()
    client.complete.return_value = '{"content": "오늘 산책을 했다.", "source_todo_ids": [1]}'
    request = DiaryGenerateRequest.model_validate(
        {
            "date": "2026-11-07",
            "activities": [{"todo_id": 1, "name": "산책"}],
        }
    )
    result = asyncio.run(DiaryGenerator(client).generate(request))
    assert result.content == "오늘 산책을 했다."
    assert result.source_todo_ids == [1]
    arguments = client.complete.call_args.kwargs
    assert arguments["system_prompt"] == SYSTEM_PROMPT
    assert json.loads(arguments["user_prompt"]) == request.model_dump(
        mode="json", exclude_none=True
    )
    client.complete.assert_awaited_once()


@pytest.mark.parametrize(
    "raw", ["not json", "null", "[]", "{}", '{"content":""}', '{"content":"일기","extra":true}']
)
def test_generator_rejects_invalid_results(raw: str) -> None:
    from app.features.diary.generator import DiaryGenerationError, DiaryGenerator

    client = AsyncMock()
    client.complete.return_value = raw
    request = DiaryGenerateRequest.model_validate({"date": "2026-11-07"})
    with pytest.raises(DiaryGenerationError, match="Invalid diary generation response"):
        asyncio.run(DiaryGenerator(client).generate(request))


def test_generator_converts_llm_failure_to_generation_error() -> None:
    from app.features.diary.generator import DiaryGenerationError, DiaryGenerator
    from app.llm.errors import LLMError

    failure = LLMError("LLM request failed")
    client = AsyncMock()
    client.complete.side_effect = failure
    request = DiaryGenerateRequest.model_validate({"date": "2026-11-07"})
    with pytest.raises(DiaryGenerationError, match="AI generation failed") as raised:
        asyncio.run(DiaryGenerator(client).generate(request))
    assert raised.value.__cause__ is failure
