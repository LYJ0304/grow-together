from datetime import date

import pytest

from app.features.schedule.schemas import (
    ActivityProposal,
    ExistingSchedule,
    ScheduleCandidate,
    ScheduleGenerationResponse,
)


def candidate(**changes):
    return ScheduleCandidate.model_validate(
        {
            "plan_name": "독서",
            "scheduled_date": "2026-11-07",
            "scheduled_time": "14:00",
            "duration_minutes": 30,
        }
        | changes
    )


@pytest.mark.parametrize(
    "kind",
    [
        "date",
        "candidate_date",
        "outside",
        "existing",
        "overlap",
        "duplicate",
        "unscheduled_duplicate",
        "count",
        "total_count",
    ],
)
def test_rejects_invalid_results(schedule_request, kind):
    from app.features.schedule.validator import ScheduleValidationError, ScheduleValidator

    result = ScheduleGenerationResponse(date=schedule_request.date, candidates=[candidate()])
    if kind == "date":
        result.date = date(2026, 11, 8)
    elif kind == "candidate_date":
        result.candidates = [candidate(scheduled_date="2026-11-08")]
    elif kind == "outside":
        result.candidates = [candidate(scheduled_time="16:45")]
    elif kind == "existing":
        schedule_request.existing_schedules = [
            ExistingSchedule(todo_id=1, plan_name="식사", start="14:15", duration_minutes=60)
        ]
    elif kind == "overlap":
        result.candidates.append(candidate(plan_name="놀이", scheduled_time="14:29"))
    elif kind == "duplicate":
        result.candidates.append(candidate(plan_name=" 독서 ", scheduled_time="15:00"))
    elif kind == "unscheduled_duplicate":
        result.unscheduled = [ActivityProposal(plan_name="독서", duration_minutes=30)]
    elif kind == "count":
        schedule_request.max_candidates = 1
        result.candidates.append(candidate(plan_name="놀이", scheduled_time="15:00"))
    elif kind == "total_count":
        schedule_request.max_candidates = 1
        result.unscheduled = [ActivityProposal(plan_name="놀이", duration_minutes=30)]
    with pytest.raises(ScheduleValidationError):
        ScheduleValidator().validate(schedule_request, result)


def test_accepts_adjacent_activities_and_unscheduled(schedule_request):
    from app.features.schedule.validator import ScheduleValidator

    schedule_request.existing_schedules = [
        ExistingSchedule(todo_id=1, plan_name="식사", start="13:00", duration_minutes=60)
    ]
    result = ScheduleGenerationResponse(
        date=schedule_request.date,
        candidates=[candidate(), candidate(plan_name="놀이", scheduled_time="14:30")],
        unscheduled=[ActivityProposal(plan_name="외출", duration_minutes=1440)],
    )
    ScheduleValidator().validate(schedule_request, result)
