from datetime import date

import pytest
from pydantic import ValidationError

from app.features.diary.schemas import (
    DiaryActivity,
    DiaryGenerateRequest,
    DiaryGenerationResponse,
    GrowthPoint,
)


def test_request_parses_date_and_defaults() -> None:
    request = DiaryGenerateRequest.model_validate({"date": "2026-11-07"})
    assert request.date == date(2026, 11, 7)
    assert request.activities == []
    assert request.tags == []
    assert request.memo is None


@pytest.mark.parametrize(
    "fields",
    [
        {},
        {"date": "invalid"},
        {"date": "2026-11-07", "extra": True},
        {"date": "2026-11-07", "memo": "a" * 2001},
        {"date": "2026-11-07", "tags": ["tag"] * 11},
        {"date": "2026-11-07", "activities": [{"name": "산책"}] * 31},
    ],
)
def test_request_rejects_invalid_fields(fields: dict) -> None:
    with pytest.raises(ValidationError):
        DiaryGenerateRequest.model_validate(fields)


@pytest.mark.parametrize(
    "fields",
    [
        {"name": ""},
        {"name": "a" * 81},
        {"name": "산책", "memo": "a" * 501},
        {"name": "산책", "extra": True},
    ],
)
def test_activity_rejects_invalid_fields(fields: dict) -> None:
    with pytest.raises(ValidationError):
        DiaryActivity.model_validate(fields)


@pytest.mark.parametrize(
    "fields",
    [
        {"content": ""},
        {"content": "a" * 1001},
        {"content": "일기", "emotions": ["기쁨"] * 6},
        {"content": "일기", "growth_points": [{"description": "관찰"}] * 6},
        {"content": "일기", "tomorrow_tip": "a" * 301},
        {"content": "일기", "extra": True},
    ],
)
def test_response_rejects_invalid_fields(fields: dict) -> None:
    with pytest.raises(ValidationError):
        DiaryGenerationResponse.model_validate(fields)


def test_schema_accepts_maximum_lengths() -> None:
    request = DiaryGenerateRequest(
        date=date(2026, 11, 7),
        memo="a" * 2000,
        tags=["tag"] * 10,
        activities=[DiaryActivity(name="a" * 80, memo="a" * 500)] * 30,
    )
    response = DiaryGenerationResponse(
        content="a" * 1000,
        emotions=["기쁨"] * 5,
        tomorrow_tip="a" * 300,
        growth_points=[GrowthPoint(description="a" * 300)] * 5,
    )
    assert len(request.activities) == 30
    assert len(response.content) == 1000


@pytest.mark.parametrize("description", ["", "a" * 301])
def test_growth_point_rejects_invalid_description(description: str) -> None:
    with pytest.raises(ValidationError):
        GrowthPoint(description=description)
