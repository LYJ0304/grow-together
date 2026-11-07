import asyncio
import json

import httpx
import pytest

from app.llm.client import OpenRouterClient
from app.llm.errors import LLMError


@pytest.fixture
def transport(monkeypatch):
    async_client_class = httpx.AsyncClient
    requests = []
    outcome = {
        "status": 200,
        "body": {
            "id": "test-completion",
            "object": "chat.completion",
            "created": 1,
            "system_fingerprint": None,
            "model": "test/model",
            "choices": [
                {
                    "index": 0,
                    "finish_reason": "stop",
                    "message": {
                        "role": "assistant",
                        "content": '{"content":"일기"}',
                    },
                },
            ],
        },
    }

    def handle(request):
        requests.append(request)
        if "exception" in outcome:
            raise outcome["exception"]
        return httpx.Response(outcome["status"], json=outcome["body"])

    def async_client_factory(**kwargs):
        outcome["http_client"] = async_client_class(**kwargs, transport=httpx.MockTransport(handle))
        return outcome["http_client"]

    monkeypatch.setattr(httpx, "AsyncClient", async_client_factory)
    return requests, outcome


def test_client_sends_authenticated_json_completion_and_returns_text(transport) -> None:
    requests, outcome = transport
    client = OpenRouterClient(api_key="test-key", model="test/model")
    assert (
        asyncio.run(client.complete(system_prompt="system", user_prompt="user"))
        == '{"content":"일기"}'
    )
    assert len(requests) == 1
    assert requests[0].headers["authorization"] == "Bearer test-key"
    assert requests[0].url.path == "/api/v1/chat/completions"
    payload = json.loads(requests[0].content)
    assert payload["model"] == "test/model"
    assert payload["messages"] == [
        {"role": "system", "content": "system"},
        {"role": "user", "content": "user"},
    ]
    assert payload["response_format"] == {"type": "json_object"}
    assert payload["stream"] is False
    assert outcome["http_client"].is_closed


@pytest.mark.parametrize("status", [401, 429, 502])
def test_client_converts_provider_errors(transport, status: int) -> None:
    _, outcome = transport
    outcome.update(status=status, body={"error": {"code": status, "message": "upstream details"}})
    client = OpenRouterClient(api_key="test-key", model="test/model")
    with pytest.raises(LLMError, match="LLM request failed"):
        asyncio.run(client.complete(system_prompt="system", user_prompt="user"))
    assert outcome["http_client"].is_closed


def test_client_converts_timeout(transport) -> None:
    _, outcome = transport
    outcome["exception"] = httpx.ReadTimeout("upstream timeout")
    client = OpenRouterClient(api_key="test-key", model="test/model")
    with pytest.raises(LLMError, match="LLM request failed"):
        asyncio.run(client.complete(system_prompt="system", user_prompt="user"))


def test_client_converts_malformed_provider_response(transport) -> None:
    _, outcome = transport
    outcome["body"] = {"unexpected": "response"}
    client = OpenRouterClient(api_key="test-key", model="test/model")
    with pytest.raises(LLMError, match="LLM request failed"):
        asyncio.run(client.complete(system_prompt="system", user_prompt="user"))


def test_client_does_not_swallow_cancellation(transport) -> None:
    _, outcome = transport
    outcome["exception"] = asyncio.CancelledError()
    client = OpenRouterClient(api_key="test-key", model="test/model")
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(client.complete(system_prompt="system", user_prompt="user"))
    assert outcome["http_client"].is_closed


@pytest.mark.parametrize(
    "choices",
    [
        [],
        [
            {
                "index": 0,
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": None,
                },
            }
        ],
        [
            {
                "index": 0,
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": "   ",
                },
            }
        ],
    ],
)
def test_client_rejects_empty_results(transport, choices) -> None:
    _, outcome = transport
    outcome["body"]["choices"] = choices
    client = OpenRouterClient(api_key="test-key", model="test/model")
    with pytest.raises(LLMError, match="Empty LLM response"):
        asyncio.run(client.complete(system_prompt="system", user_prompt="user"))


def test_client_identifies_timeout_for_gateway_mapping(transport) -> None:
    _, outcome = transport
    outcome["exception"] = httpx.ReadTimeout("private upstream details")
    client = OpenRouterClient(api_key="test-key", model="test/model")
    with pytest.raises(LLMError) as raised:
        asyncio.run(client.complete(system_prompt="system", user_prompt="user"))
    assert type(raised.value).__name__ == "LLMTimeoutError"
