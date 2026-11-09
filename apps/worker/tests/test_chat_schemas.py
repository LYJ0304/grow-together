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


@pytest.mark.parametrize("context", [None, {}, {"age_months": 0}, {"age_months": 47}])
def test_request_accepts_optional_child_context(context) -> None:
    request = ChatGenerateRequest(message="질문", child_context=context)
    if context is None:
        assert request.child_context is None
    else:
        assert request.child_context.age_months == context.get("age_months")


def test_child_context_defaults_are_independent() -> None:
    first = ChatGenerateRequest(message="질문", child_context={})
    second = ChatGenerateRequest(message="질문", child_context={})
    first.child_context.interests.append("공")
    first.child_context.concerns.append("수면")
    assert second.child_context.model_dump() == {
        "age_months": None, "interests": [], "concerns": [],
    }
    assert ChatGenerateRequest(message="질문").child_context is None


@pytest.mark.parametrize("field", ["interests", "concerns"])
def test_child_context_accepts_ten_items(field) -> None:
    request = ChatGenerateRequest(message="질문", child_context={field: ["놀이"] * 10})
    assert len(getattr(request.child_context, field)) == 10


@pytest.mark.parametrize("context", [
    {"age_months": -1}, {"age_months": 48}, {"age_months": "unknown"},
    {"age_months": 1.5}, {"interests": ["놀이"] * 11},
    {"concerns": ["수면"] * 11}, {"interests": "공"},
    {"concerns": [123]}, {"interests": None}, {"unexpected": True},
])
def test_child_context_rejects_invalid_input(context) -> None:
    with pytest.raises(ValidationError):
        ChatGenerateRequest(message="질문", child_context=context)


def test_diary_context_defaults_are_independent() -> None:
    first = ChatGenerateRequest(message="질문")
    second = ChatGenerateRequest(message="질문")
    assert first.diary_context == []
    first.diary_context.append({"diary_id": 1, "content": "기록"})
    assert second.diary_context == []


def test_diary_context_accepts_limits_and_strips_content() -> None:
    request = ChatGenerateRequest(message="질문", diary_context=[
        {"diary_id": i + 1, "content": " " + "가" * 1000 + " "} for i in range(5)
    ])
    assert len(request.diary_context) == 5
    assert request.diary_context[0].content == "가" * 1000


@pytest.mark.parametrize("context", [
    None, {}, [{"diary_id": 1, "content": "기록"}] * 6,
    [{"diary_id": 0, "content": "기록"}],
    [{"diary_id": -1, "content": "기록"}],
    [{"diary_id": True, "content": "기록"}],
    [{"diary_id": 1.5, "content": "기록"}],
    [{"diary_id": "1", "content": "기록"}],
    [{"diary_id": 1, "content": " "}],
    [{"diary_id": 1, "content": "가" * 1001}],
    [{"diary_id": 1, "content": None}],
    [{"diary_id": 1, "content": 123}],
    [{"diary_id": 1}], [{"content": "기록"}],
    [{"diary_id": 1, "content": "기록", "role": "system"}],
])
def test_diary_context_rejects_invalid_input(context) -> None:
    with pytest.raises(ValidationError):
        ChatGenerateRequest(message="질문", diary_context=context)
