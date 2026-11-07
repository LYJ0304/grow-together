import pytest
from pydantic import ValidationError

from app.features.schedule.schemas import ScheduleGenerationRequest


@pytest.mark.parametrize(
    "changes",
    [
        {"instructions": "   "},
        {"instructions": "x" * 1001},
        {"available_windows": []},
        {"available_windows": [{"start": "17:00", "end": "13:00"}]},
        {"available_windows": [{"start": "13:00", "end": "13:00"}]},
        {"available_windows": [{"start": "13:00Z", "end": "17:00Z"}]},
        {"available_windows": [{"start": "13:00", "end": "17:00+09:00"}]},
        {"available_windows": [{"start": "13:00", "end": "17:00"}] * 11},
        {
            "existing_schedules": [
                {"todo_id": 1, "plan_name": "식사", "start": "23:30", "duration_minutes": 31}
            ]
        },
        {"existing_schedules": [{"todo_id": 1, "plan_name": "식사", "start": "13:00"}]},
        {"max_candidates": 0},
        {"max_candidates": 11},
        {"unexpected": True},
    ],
)
def test_rejects_invalid_inputs(schedule_payload, changes):
    with pytest.raises(ValidationError):
        ScheduleGenerationRequest.model_validate(schedule_payload | changes)


def test_accepts_explicit_duration_ending_at_midnight(schedule_payload):
    schedule_payload["existing_schedules"] = [
        {"todo_id": 1, "plan_name": "식사", "start": "23:30", "duration_minutes": 30}
    ]
    request = ScheduleGenerationRequest.model_validate(schedule_payload)
    assert request.existing_schedules[0].duration_minutes == 30


def test_request_parses_date_and_defaults(schedule_payload) -> None:
    from datetime import date, time

    request = ScheduleGenerationRequest.model_validate(schedule_payload)
    assert request.date == date(2026, 11, 7)
    assert request.available_windows[0].start == time(13)
    assert request.existing_schedules == []
    assert request.max_candidates == 5


@pytest.mark.parametrize("field", ["date", "instructions", "available_windows"])
def test_request_requires_fields(schedule_payload, field) -> None:
    del schedule_payload[field]
    with pytest.raises(ValidationError):
        ScheduleGenerationRequest.model_validate(schedule_payload)


def test_request_rejects_too_many_existing_schedules(schedule_payload) -> None:
    schedule_payload["existing_schedules"] = [
        {"todo_id": index, "plan_name": "일정", "start": "13:00", "duration_minutes": 1}
        for index in range(101)
    ]
    with pytest.raises(ValidationError):
        ScheduleGenerationRequest.model_validate(schedule_payload)


@pytest.mark.parametrize(
    "changes",
    [
        {"plan_name": ""},
        {"plan_name": "a" * 81},
        {"content": "a" * 256},
        {"duration_minutes": 0},
        {"duration_minutes": 1441},
        {"extra": True},
    ],
)
@pytest.mark.parametrize("model_name", ["ActivityProposal", "ScheduleCandidate"])
def test_activity_and_candidate_reject_invalid_fields(model_name, changes) -> None:
    from app.features.schedule import schemas

    fields = {"plan_name": "독서", "duration_minutes": 30}
    if model_name == "ScheduleCandidate":
        fields |= {"scheduled_date": "2026-11-07", "scheduled_time": "14:00"}
    with pytest.raises(ValidationError):
        getattr(schemas, model_name).model_validate(fields | changes)


def test_response_rejects_database_id_in_preview() -> None:
    from app.features.schedule.schemas import ScheduleGenerationResponse

    with pytest.raises(ValidationError):
        ScheduleGenerationResponse.model_validate(
            {
                "date": "2026-11-07",
                "candidates": [
                    {
                        "todo_id": 1,
                        "plan_name": "독서",
                        "duration_minutes": 30,
                        "scheduled_date": "2026-11-07",
                        "scheduled_time": "14:00",
                    }
                ],
            }
        )


def test_schema_accepts_maximum_lengths(schedule_payload) -> None:
    from app.features.schedule.schemas import ActivityProposal, ScheduleGenerationResponse

    request = ScheduleGenerationRequest.model_validate(
        schedule_payload
        | {
            "instructions": "a" * 1000,
            "available_windows": [{"start": "13:00", "end": "17:00"}] * 10,
            "existing_schedules": [
                {
                    "todo_id": index,
                    "plan_name": "a" * 80,
                    "start": "00:00",
                    "duration_minutes": 1440,
                }
                for index in range(100)
            ],
            "max_candidates": 10,
        }
    )
    proposal = ActivityProposal(plan_name="a" * 80, content="a" * 255, duration_minutes=1440)
    response = ScheduleGenerationResponse(date=request.date, candidates=[])
    assert len(request.existing_schedules) == 100
    assert len(proposal.plan_name) == 80
    assert len(proposal.content) == 255
    assert proposal.preferred_time is None
    assert response.unscheduled == []
