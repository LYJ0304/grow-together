import asyncio
import json
from unittest.mock import AsyncMock, Mock

import pytest

from app.features.schedule.planner import ScheduleGenerationError, SchedulePlanner
from app.features.schedule.schemas import (
    ActivityProposal,
    ScheduleCandidate,
    ScheduleGenerationRequest,
    ScheduleGenerationResponse,
)
from app.features.schedule.service import ScheduleService
from app.features.schedule.validator import ScheduleValidationError, ScheduleValidator


def with_time(payload, preference):
    return ScheduleGenerationRequest.model_validate(
        payload
        | {
            "child_context": {
                "age_months": 48,
                "personalization": {
                    "concern_codes": ["communication"],
                    "available_activity_time": preference,
                },
            },
        }
    )


@pytest.mark.parametrize("preference,cap", [("5min", 5), ("10min", 10), ("15to20min", 20)])
def test_planner_passes_personalization_and_rejects_total_excess(schedule_payload, preference, cap):
    request = with_time(schedule_payload, preference)
    before = request.model_dump()
    client = AsyncMock()
    client.complete.return_value = json.dumps(
        {
            "activities": [
                {"plan_name": "책 읽기", "duration_minutes": cap},
                {"plan_name": "대화", "duration_minutes": 1},
            ]
        }
    )
    with pytest.raises(ScheduleGenerationError):
        asyncio.run(SchedulePlanner(client).plan(request))
    kwargs = client.complete.call_args.kwargs
    context = json.loads(kwargs["user_prompt"])
    assert context["activity_budget_minutes"] == cap
    assert context["child_context"]["age_months"] == 48
    assert context["child_context"]["personalization"]["concern_labels"] == ["언어와 소통"]
    assert "unscheduled" in kwargs["system_prompt"]
    assert "corrected age" in kwargs["system_prompt"]
    assert request.model_dump() == before


@pytest.mark.parametrize("preference,cap", [("5min", 5), ("10min", 10), ("15to20min", 20)])
def test_service_accepts_exact_budget_without_subtracting_existing(
    schedule_payload, preference, cap
):
    request = with_time(
        schedule_payload
        | {
            "existing_schedules": [
                {"todo_id": 1, "plan_name": "기존 일정", "start": "13:00", "duration_minutes": 60},
            ]
        },
        preference,
    )
    before = request.model_dump()
    client = AsyncMock()
    client.complete.return_value = json.dumps(
        {
            "activities": [
                {"plan_name": "책 읽기", "duration_minutes": cap - 1},
                {"plan_name": "대화", "duration_minutes": 1},
            ]
        }
    )
    from app.features.schedule.scheduler import ScheduleScheduler

    result = asyncio.run(
        ScheduleService(
            SchedulePlanner(client),
            ScheduleScheduler(),
            ScheduleValidator(),
        ).generate(request)
    )
    assert sum(c.duration_minutes for c in result.candidates) == cap
    assert result.candidates[0].scheduled_time.isoformat() == "14:00:00"
    assert request.model_dump() == before


@pytest.mark.parametrize("preference", [None, "flexible"])
def test_no_arbitrary_budget_for_missing_or_flexible(schedule_payload, preference):
    request = with_time(schedule_payload, preference)
    client = AsyncMock()
    client.complete.return_value = json.dumps(
        {
            "activities": [
                {"plan_name": "나들이", "duration_minutes": 100},
            ]
        }
    )
    result = asyncio.run(SchedulePlanner(client).plan(request))
    assert result[0].duration_minutes == 100
    assert "activity_budget_minutes" not in json.loads(
        client.complete.call_args.kwargs["user_prompt"]
    )


@pytest.mark.parametrize("context", [None, {}, {"personalization": {}}, {"personalization": None}])
def test_empty_context_keeps_original_planner_prompts(schedule_payload, context):
    from app.features.schedule.prompts.generation import SYSTEM_PROMPT

    request = ScheduleGenerationRequest.model_validate(
        schedule_payload | {"child_context": context}
    )
    client = AsyncMock()
    client.complete.return_value = '{"activities":[{"plan_name":"독서","duration_minutes":30}]}'
    asyncio.run(SchedulePlanner(client).plan(request))
    assert client.complete.call_args.kwargs["system_prompt"] == SYSTEM_PROMPT
    assert "child_context" not in json.loads(client.complete.call_args.kwargs["user_prompt"])


def test_validator_counts_candidates_and_unscheduled_together(schedule_payload):
    request = with_time(schedule_payload, "5min")
    result = ScheduleGenerationResponse(
        date=request.date,
        candidates=[
            ScheduleCandidate(
                plan_name="책 읽기",
                scheduled_date=request.date,
                scheduled_time="13:00",
                duration_minutes=3,
            )
        ],
        unscheduled=[ActivityProposal(plan_name="대화", duration_minutes=3)],
    )
    with pytest.raises(ScheduleValidationError, match="activity time budget"):
        ScheduleValidator().validate(request, result)
    result.unscheduled[0].duration_minutes = 2
    ScheduleValidator().validate(request, result)


def test_service_checks_all_proposals_before_scheduler_can_drop_any(schedule_payload):
    request = with_time(schedule_payload | {"max_candidates": 1}, "5min")
    planner = Mock(
        plan=AsyncMock(
            return_value=[
                ActivityProposal(plan_name="책 읽기", duration_minutes=5),
                ActivityProposal(plan_name="대화", duration_minutes=1),
            ]
        )
    )
    scheduler = Mock()
    with pytest.raises(ScheduleValidationError, match="activity time budget"):
        asyncio.run(ScheduleService(planner, scheduler, ScheduleValidator()).generate(request))
    scheduler.schedule.assert_not_called()


def test_twenty_minute_cap_does_not_require_fifteen_minutes(schedule_payload):
    request = with_time(schedule_payload, "15to20min")
    client = AsyncMock()
    client.complete.return_value = '{"activities":[{"plan_name":"독서","duration_minutes":5}]}'
    assert asyncio.run(SchedulePlanner(client).plan(request))[0].duration_minutes == 5
