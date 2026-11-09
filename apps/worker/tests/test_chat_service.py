import asyncio
from unittest.mock import AsyncMock, Mock

import pytest

from app.features.chat.schemas import ChatGenerateRequest, ChatGenerateResponse


@pytest.mark.parametrize(
    "history",
    [
        [],
        [
            {"role": "user", "content": "이전 질문"},
            {"role": "assistant", "content": "이전 답변"},
        ],
    ],
)
def test_service_sends_system_history_and_current_message_in_order(history) -> None:
    from app.features.chat.service import SYSTEM_PROMPT, ChatService

    request = ChatGenerateRequest(message="현재 질문", history=history)
    before = request.model_dump()
    result = ChatGenerateResponse(content="답변", model="test/model")
    generator = Mock(generate=AsyncMock(return_value=result))

    response = asyncio.run(ChatService(generator).generate(request))

    generator.generate.assert_awaited_once_with(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            *history,
            {"role": "user", "content": "현재 질문"},
        ]
    )
    assert response.content == "답변"
    assert response.model == "test/model"
    assert request.model_dump() == before


def test_service_propagates_generator_failure() -> None:
    from app.features.chat.service import ChatService

    error = RuntimeError("generation failed")
    generator = Mock(generate=AsyncMock(side_effect=error))
    with pytest.raises(RuntimeError) as caught:
        asyncio.run(ChatService(generator).generate(ChatGenerateRequest(message="질문")))
    assert caught.value is error
