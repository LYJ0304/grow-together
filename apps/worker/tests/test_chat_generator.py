import asyncio
from unittest.mock import AsyncMock, Mock

import pytest

from app.llm.errors import LLMError


def test_generator_returns_chat_content_and_model() -> None:
    from app.features.chat.generator import ChatGenerator

    messages = [{"role": "user", "content": "질문"}]
    client = Mock(model="test/chat", complete_chat=AsyncMock(return_value="답변"))
    response = asyncio.run(ChatGenerator(client).generate(messages))
    assert response.content == "답변"
    assert response.model == "test/chat"
    client.complete_chat.assert_awaited_once_with(messages=messages)


def test_generator_propagates_llm_failure() -> None:
    from app.features.chat.generator import ChatGenerator

    client = Mock(complete_chat=AsyncMock(side_effect=LLMError("failed")))
    with pytest.raises(LLMError):
        asyncio.run(ChatGenerator(client).generate([]))
