import pytest

from app.features.diary.schemas import DiaryGenerateRequest, DiaryGenerationResponse


@pytest.mark.parametrize("source_ids", [[], [1], [1, 2]])
def test_validator_accepts_only_known_sources(source_ids: list[int]) -> None:
    from app.features.diary.validator import DiaryValidator

    request = DiaryGenerateRequest.model_validate(
        {
            "date": "2026-11-07",
            "activities": [
                {"todo_id": 1, "name": "산책"},
                {"todo_id": 2, "name": "식사"},
                {"name": "메모"},
            ],
        }
    )
    response = DiaryGenerationResponse(content="일기", source_todo_ids=source_ids)
    DiaryValidator().validate(request, response)


@pytest.mark.parametrize("target", ["diary", "growth_point"])
@pytest.mark.parametrize(
    ("source_ids", "message"),
    [
        ([1, 1], "Duplicate source IDs"),
        ([99], "Unknown source IDs"),
    ],
)
def test_validator_rejects_duplicate_and_unknown_sources(target, source_ids, message) -> None:
    from app.features.diary.validator import DiaryValidationError, DiaryValidator

    request = DiaryGenerateRequest.model_validate(
        {
            "date": "2026-11-07",
            "activities": [{"todo_id": 1, "name": "산책"}],
        }
    )
    fields = {"content": "일기", "source_todo_ids": source_ids}
    if target == "growth_point":
        fields = {
            "content": "일기",
            "growth_points": [
                {"description": "관찰", "source_todo_ids": source_ids},
            ],
        }
    with pytest.raises(DiaryValidationError, match=message):
        DiaryValidator().validate(request, DiaryGenerationResponse.model_validate(fields))


def test_validator_rejects_sources_when_request_has_no_activities() -> None:
    from app.features.diary.validator import DiaryValidationError, DiaryValidator

    request = DiaryGenerateRequest.model_validate({"date": "2026-11-07"})
    with pytest.raises(DiaryValidationError, match="Unknown source IDs"):
        DiaryValidator().validate(
            request, DiaryGenerationResponse(content="일기", source_todo_ids=[1])
        )
