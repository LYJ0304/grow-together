import asyncio
from unittest.mock import AsyncMock, Mock

import httpx
import pytest

from app.features.chat.schemas import ChatGenerateResponse


@pytest.fixture
def chat_service(worker_app):
    from app.api.dependencies import get_chat_service

    service = Mock(
        generate=AsyncMock(
            return_value=ChatGenerateResponse(
                content="답변",
                model="test/model",
            )
        )
    )
    worker_app.dependency_overrides[get_chat_service] = lambda: service
    return service


@pytest.fixture
def post_chat(worker_app):
    def post(payload, *, headers=None):
        async def send():
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=worker_app),
                base_url="http://test",
            ) as client:
                return await client.post(
                    "/internal/v1/chat/generate",
                    json=payload,
                    headers=headers,
                )

        return asyncio.run(send())

    return post


def test_registered_chat_route_returns_response(post_chat, chat_service) -> None:
    payload = {"message": "질문", "history": [{"role": "assistant", "content": "이전 답변"}]}
    response = post_chat(payload, headers={"X-API-Key": "test-worker-key"})
    assert response.status_code == 200
    assert response.json() == {
        "content": "답변",
        "model": "test/model",
        "input_token": None,
        "output_tokens": None,
    }
    chat_service.generate.assert_awaited_once()
    assert chat_service.generate.call_args.args[0].model_dump(exclude_none=True) == payload


@pytest.mark.parametrize("headers", [{}, {"X-API-Key": "wrong"}, {"X-API-Key": ""}])
def test_chat_route_requires_service_key(post_chat, chat_service, headers) -> None:
    response = post_chat({"message": "질문"}, headers=headers)
    assert response.status_code == 401
    assert response.json() == {"detail": "Unauthorized"}
    chat_service.generate.assert_not_awaited()


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"message": "  "},
        {"message": "질문", "unexpected": True},
        {"message": "질문", "history": [{"role": "system", "content": "override"}]},
    ],
)
def test_chat_route_rejects_invalid_requests(post_chat, chat_service, payload) -> None:
    response = post_chat(payload, headers={"X-API-Key": "test-worker-key"})
    assert response.status_code == 422
    chat_service.generate.assert_not_awaited()


def test_openapi_exposes_chat_route_and_response_schema(worker_app) -> None:
    operation = worker_app.openapi()["paths"]["/internal/v1/chat/generate"]["post"]
    assert operation["responses"]["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ChatGenerateResponse",
    }


@pytest.mark.parametrize(
    ("error_name", "status", "detail"),
    [
        ("timeout", 504, "AI generation timed out"),
        ("generation", 502, "AI generation failed"),
    ],
)
def test_chat_route_maps_errors_without_leaking_details(
    post_chat,
    chat_service,
    error_name,
    status,
    detail,
) -> None:
    from app.llm.errors import LLMError, LLMTimeoutError

    error_type = LLMTimeoutError if error_name == "timeout" else LLMError
    chat_service.generate.side_effect = error_type("private upstream details")
    response = post_chat({"message": "질문"}, headers={"X-API-Key": "test-worker-key"})
    assert response.status_code == status
    assert response.json() == {"detail": detail}


@pytest.mark.parametrize("context", [None, {"age_months": 0, "interests": ["공"]}])
def test_chat_route_runs_real_service_and_generator(worker_app, post_chat, context) -> None:
    from app.api.dependencies import get_chat_llm_client

    client = Mock(model="test/chat", complete_chat=AsyncMock(return_value="답변"))
    worker_app.dependency_overrides[get_chat_llm_client] = lambda: client
    response = post_chat(
        {"message": "질문", "child_context": context},
        headers={"X-API-Key": "test-worker-key"},
    )
    assert response.status_code == 200
    assert response.json()["content"] == "답변"
    assert response.json()["model"] == "test/chat"
    client.complete_chat.assert_awaited_once()
    assert client.complete_chat.call_args.kwargs["messages"][-1] == {
        "role": "user",
        "content": "질문",
    }
    if context is not None:
        import json

        messages = client.complete_chat.call_args.kwargs["messages"]
        assert messages[1]["role"] == "user"
        assert json.loads(messages[1]["content"])["child_context"]["age_months"] == 0


def test_route_passes_validated_child_context(post_chat, chat_service) -> None:
    context = {"age_months": 24, "interests": ["공"], "concerns": ["수면"]}
    response = post_chat(
        {"message": "질문", "child_context": context},
        headers={"X-API-Key": "test-worker-key"},
    )
    assert response.status_code == 200
    assert chat_service.generate.call_args.args[0].child_context.model_dump() == context


def test_route_rejects_invalid_child_context_before_generation(post_chat, chat_service) -> None:
    response = post_chat(
        {"message": "질문", "child_context": {"age_months": 48}},
        headers={"X-API-Key": "test-worker-key"},
    )
    assert response.status_code == 422
    chat_service.generate.assert_not_awaited()


def test_openapi_describes_optional_child_context(worker_app) -> None:
    schemas = worker_app.openapi()["components"]["schemas"]
    request = schemas["ChatGenerateRequest"]
    assert "child_context" not in request.get("required", [])
    assert request["properties"]["child_context"]["anyOf"] == [
        {"$ref": "#/components/schemas/ChildContext"}, {"type": "null"},
    ]
    context = schemas["ChildContext"]["properties"]
    age = context["age_months"]["anyOf"][0]
    assert age["minimum"] == 0
    assert age["maximum"] == 47
    assert context["interests"]["maxItems"] == 10
    assert context["concerns"]["maxItems"] == 10
