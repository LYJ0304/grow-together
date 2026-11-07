import asyncio
import json
from unittest.mock import AsyncMock

import pytest

from app.llm.errors import LLMError


def test_planner_parses_proposals_and_passes_request(schedule_request):
    from app.features.schedule.planner import SchedulePlanner
    from app.features.schedule.prompts.generation import SYSTEM_PROMPT

    client = AsyncMock()
    client.complete.return_value = json.dumps(
        {"activities": [{"plan_name": "독서", "duration_minutes": 30, "preferred_time": "15:00"}]}
    )
    proposals = asyncio.run(SchedulePlanner(client).plan(schedule_request))
    assert proposals[0].plan_name == "독서"
    client.complete.assert_awaited_once()
    assert client.complete.call_args.kwargs["system_prompt"] == SYSTEM_PROMPT
    assert json.loads(client.complete.call_args.kwargs["user_prompt"]) == (
        schedule_request.model_dump(mode="json", exclude_none=True)
    )


@pytest.mark.parametrize(
    "raw",
    [
        "not json",
        "null",
        "[]",
        "{}",
        '{"activities":{}}',
        '{"activities":[]}',
        '{"activities":[{"plan_name":"","duration_minutes":30}]}',
        '{"activities":[{"plan_name":"독서","duration_minutes":0}]}',
        '{"activities":[{"plan_name":"독서","duration_minutes":30,"scheduled_time":"15:00"}]}',
        '{"activities":[{"plan_name":"독서","duration_minutes":30,"preferred_time":"15:00Z"}]}',
    ],
)
def test_planner_rejects_invalid_output(schedule_request, raw):
    from app.features.schedule.planner import ScheduleGenerationError, SchedulePlanner

    client = AsyncMock()
    client.complete.return_value = raw
    with pytest.raises(ScheduleGenerationError, match="Invalid schedule generation response"):
        asyncio.run(SchedulePlanner(client).plan(schedule_request))


def test_planner_rejects_excess_instead_of_silently_truncating(schedule_request):
    from app.features.schedule.planner import ScheduleGenerationError, SchedulePlanner

    schedule_request.max_candidates = 1
    client = AsyncMock()
    client.complete.return_value = json.dumps(
        {
            "activities": [
                {"plan_name": "독서", "duration_minutes": 30},
                {"plan_name": "놀이", "duration_minutes": 30},
            ]
        }
    )
    with pytest.raises(ScheduleGenerationError):
        asyncio.run(SchedulePlanner(client).plan(schedule_request))


def test_planner_wraps_provider_failure(schedule_request):
    from app.features.schedule.planner import ScheduleGenerationError, SchedulePlanner

    client = AsyncMock()
    failure = LLMError("private upstream details")
    client.complete.side_effect = failure
    with pytest.raises(ScheduleGenerationError, match="AI generation failed") as raised:
        asyncio.run(SchedulePlanner(client).plan(schedule_request))
    assert raised.value.__cause__ is failure


def test_planner_preserves_timeout(schedule_request):
    from app.features.schedule.planner import SchedulePlanner
    from app.llm.errors import LLMTimeoutError

    client = AsyncMock()
    client.complete.side_effect = LLMTimeoutError("private upstream details")
    with pytest.raises(LLMTimeoutError):
        asyncio.run(SchedulePlanner(client).plan(schedule_request))
