import asyncio
from unittest.mock import AsyncMock, Mock

import pytest

from app.features.schedule.schemas import ActivityProposal


def test_service_runs_workflow_in_order(schedule_request):
    from app.features.schedule.scheduler import ScheduleScheduler
    from app.features.schedule.service import ScheduleService
    from app.features.schedule.validator import ScheduleValidator

    calls = []

    async def plan(request):
        calls.append("plan")
        return [
            ActivityProposal(plan_name="독서", duration_minutes=30),
            ActivityProposal(plan_name="외출", duration_minutes=1440),
        ]

    def schedule(request, activities):
        calls.append("schedule")
        return ScheduleScheduler().schedule(request, activities)

    def validate(request, response):
        calls.append("validate")
        ScheduleValidator().validate(request, response)

    service = ScheduleService(Mock(plan=plan), Mock(schedule=schedule), Mock(validate=validate))
    result = asyncio.run(service.generate(schedule_request))
    assert calls == ["plan", "schedule", "validate"]
    assert result.candidates[0].plan_name == "독서"
    assert result.unscheduled[0].plan_name == "외출"


@pytest.mark.parametrize("stage", ["planner", "validator"])
def test_service_propagates_failures(schedule_request, stage):
    from app.features.schedule.planner import ScheduleGenerationError
    from app.features.schedule.service import ScheduleService
    from app.features.schedule.validator import ScheduleValidationError

    planner = Mock(plan=AsyncMock(return_value=[]))
    scheduler = Mock(schedule=Mock(return_value=([], [])))
    validator = Mock()
    failure = (
        ScheduleGenerationError("failure")
        if stage == "planner"
        else (ScheduleValidationError("failure"))
    )
    if stage == "planner":
        planner.plan.side_effect = failure
    else:
        validator.validate.side_effect = failure
    with pytest.raises(type(failure)) as raised:
        asyncio.run(ScheduleService(planner, scheduler, validator).generate(schedule_request))
    assert raised.value is failure
    if stage == "planner":
        scheduler.schedule.assert_not_called()
        validator.validate.assert_not_called()


def test_service_passes_proposals_and_validates_the_returned_result(schedule_request) -> None:
    from app.features.schedule.schemas import ScheduleCandidate
    from app.features.schedule.service import ScheduleService

    activities = [ActivityProposal(plan_name="독서", duration_minutes=30)]
    candidates = [
        ScheduleCandidate(
            plan_name="독서",
            duration_minutes=30,
            scheduled_date=schedule_request.date,
            scheduled_time="13:00",
        )
    ]
    planner = Mock(plan=AsyncMock(return_value=activities))
    scheduler = Mock(schedule=Mock(return_value=(candidates, [])))
    validator = Mock()
    result = asyncio.run(ScheduleService(planner, scheduler, validator).generate(schedule_request))
    planner.plan.assert_awaited_once_with(schedule_request)
    scheduler.schedule.assert_called_once_with(schedule_request, activities)
    validator.validate.assert_called_once_with(schedule_request, result)
    assert result.candidates == candidates
    assert validator.validate.call_args.args[1] is result
