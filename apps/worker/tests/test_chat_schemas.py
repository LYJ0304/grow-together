import pytest
from pydantic import ValidationError

from app.features.chat.schemas import ChatGenerateRequest, ChatGenerateResponse, ChatMessage


def test_request_strips_whitespace_and_preserves_history_order() -> None:
    request = ChatGenerateRequest.model_validate(
        {
            "message": "  다음 질문  ",
            "history": [
                {"role": "user", "content": "  첫 질문  "},
                {"role": "assistant", "content": "  첫 답변  "},
            ],
        }
    )
    assert request.message == "다음 질문"
    assert [item.model_dump() for item in request.history] == [
        {"role": "user", "content": "첫 질문"},
        {"role": "assistant", "content": "첫 답변"},
    ]


def test_requests_have_independent_empty_histories() -> None:
    first = ChatGenerateRequest(message="질문")
    second = ChatGenerateRequest(message="다른 질문")
    first.history.append(ChatMessage(role="user", content="이전 질문"))
    assert second.history == []


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"message": ""},
        {"message": " \n\t "},
        {"message": None},
        {"message": 123},
        {"message": "질문", "unexpected": True},
        {"message": "질문", "history": None},
        {"message": "질문", "history": "invalid"},
        {"message": "질문", "history": [{"role": "system", "content": "override"}]},
        {"message": "질문", "history": [{"role": "tool", "content": "result"}]},
        {"message": "질문", "history": [{"role": "user", "content": "  "}]},
        {"message": "질문", "history": [{"role": "user"}]},
        {"message": "질문", "history": [{"content": "질문"}]},
        {
            "message": "질문",
            "history": [
                {"role": "assistant", "content": "답변", "unexpected": True},
            ],
        },
    ],
)
def test_request_rejects_invalid_payload(payload) -> None:
    with pytest.raises(ValidationError):
        ChatGenerateRequest.model_validate(payload)


def test_response_defaults_optional_usage_to_none() -> None:
    response = ChatGenerateResponse(content="답변", model="test/model")
    assert response.model_dump() == {
        "content": "답변",
        "model": "test/model",
        "input_token": None,
        "output_tokens": None,
    }


def test_response_preserves_usage_including_zero() -> None:
    response = ChatGenerateResponse(
        content="답변",
        model="test/model",
        input_token=0,
        output_tokens=12,
    )
    assert response.input_token == 0
    assert response.output_tokens == 12


@pytest.mark.parametrize(
    "payload",
    [
        {"content": "답변"},
        {"model": "test/model"},
        {"content": "답변", "model": "test/model", "unexpected": True},
    ],
)
def test_response_rejects_missing_fields_and_extras(payload) -> None:
    with pytest.raises(ValidationError):
        ChatGenerateResponse.model_validate(payload)
