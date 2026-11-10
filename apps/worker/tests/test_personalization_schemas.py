import pytest
from pydantic import ValidationError

from app.features.chat.schemas import ChatGenerateRequest
from app.features.schedule.schemas import ScheduleGenerationRequest


def request(kind, context):
    if kind == "chat":
        return ChatGenerateRequest(message="질문", child_context=context)
    return ScheduleGenerationRequest(
        date="2026-11-10",
        instructions="같이 놀기",
        available_windows=[{"start": "09:00", "end": "10:00"}],
        child_context=context,
    )


@pytest.mark.parametrize("kind", ["chat", "schedule"])
@pytest.mark.parametrize("age", [0, 47, 48])
def test_accepts_service_age_boundary(kind, age):
    assert request(kind, {"age_months": age}).child_context.age_months == age


@pytest.mark.parametrize("kind", ["chat", "schedule"])
@pytest.mark.parametrize("context", [None, {}, {"personalization": None}, {"personalization": {}}])
def test_optional_context(kind, context):
    result = request(kind, context)
    assert (result.child_context is None) == (context is None)


@pytest.mark.parametrize("kind", ["chat", "schedule"])
def test_personalization_preserves_legacy_concerns_and_future_due_date(kind):
    result = request(
        kind,
        {
            "concerns": ["자유 텍스트 고민"],
            "interests": ["그림책"],
            "personalization": {
                "concern_codes": ["sleep", "communication"],
                "prematurity_status": "yes",
                "birthday": "2024-01-01",
                "expected_due_date": "2099-02-01",
                "available_activity_time": "15to20min",
                "development_observations": [],
            },
        },
    )
    assert result.child_context.concerns == ["자유 텍스트 고민"]
    assert result.child_context.personalization.expected_due_date.isoformat() == "2099-02-01"


@pytest.mark.parametrize("kind", ["chat", "schedule"])
@pytest.mark.parametrize(
    "personalization",
    [
        {"concern_codes": ["sleep", "feeding", "communication"]},
        {"concern_codes": ["sleep", "sleep"]},
        {"concern_codes": ["none", "sleep"]},
        {"concern_codes": ["unreviewed"]},
        {"concern_codes": None},
        {"available_activity_time": "20min"},
        {"prematurity_status": True},
        {"expected_due_date": "2024-03-01"},
        {"prematurity_status": "no", "birthday": "2024-01-01", "expected_due_date": "2024-03-01"},
        {"prematurity_status": "yes", "expected_due_date": "2024-03-01"},
        {"prematurity_status": "yes", "birthday": "2024-03-01", "expected_due_date": "2024-03-01"},
        {"prematurity_status": "yes", "birthday": "2024-03-02", "expected_due_date": "2024-03-01"},
        {"birthday": "2024-02-30"},
        {"birthday": 0},
        {"development_observations": [{"question_id": "unapproved", "answer": "yes"}]},
        {"development_observations": [{"question_id": "x", "answer": "delayed"}]},
        {"development_observations": [{"question_id": "x", "answer": "unknown"}] * 2},
        {"development_observations": [{"question_id": str(i), "answer": "yes"} for i in range(6)]},
        {"development_observations": None},
        {"source": "caller says reviewed"},
    ],
)
def test_rejects_invalid_or_unapproved_personalization(kind, personalization):
    with pytest.raises(ValidationError):
        request(kind, {"personalization": personalization})


@pytest.mark.parametrize("kind", ["chat", "schedule"])
def test_out_of_range_age_is_not_clamped(kind):
    with pytest.raises(ValidationError):
        request(kind, {"age_months": 49})


@pytest.mark.parametrize("kind", ["chat", "schedule"])
def test_empty_selections_are_distinct_from_none_and_defaults_are_independent(kind):
    one = request(kind, {"personalization": {}})
    two = request(kind, {"personalization": {"concern_codes": ["none"]}})
    one.child_context.personalization.concern_codes.append("sleep")
    assert two.child_context.personalization.concern_codes == ["none"]
    assert request(kind, {"personalization": {}}).child_context.personalization.concern_codes == []
