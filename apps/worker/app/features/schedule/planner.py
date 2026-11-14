import json

from pydantic import Field, ValidationError

from app.features.child_context import (
    PERSONALIZATION_GUIDANCE,
    activity_budget_minutes,
    child_context_data,
)
from app.llm.client import LLMClient
from app.llm.errors import LLMError, LLMTimeoutError

from .prompts.generation import ACTIVITY_FEEDBACK_PROMPT, PERSONALIZATION_PROMPT, SYSTEM_PROMPT
from .schemas import ActivityProposal, ScheduleBase, ScheduleGenerationRequest
from .validator import ScheduleValidationError, validate_activity_budget


class ScheduleGenerationError(Exception):
    pass


class ActivityPlan(ScheduleBase):
    activities: list[ActivityProposal] = Field(min_length=1, max_length=10)


class SchedulePlanner:
    def __init__(self, llm_client: LLMClient):
        self.llm_client = llm_client

    async def plan(self, request: ScheduleGenerationRequest) -> list[ActivityProposal]:
        payload = request.model_dump(
            mode="json",
            exclude_none=True,
            exclude={"child_context", "activity_feedback", "activity_feedback_truncated"},
        )
        system_prompt = SYSTEM_PROMPT
        if request.activity_feedback:
            payload["activity_feedback"] = [
                item.model_dump(mode="json") for item in request.activity_feedback
            ]
            payload["activity_feedback_truncated"] = request.activity_feedback_truncated
            system_prompt += "\n\n" + ACTIVITY_FEEDBACK_PROMPT
        context = child_context_data(request.child_context)
        if context is not None:
            payload["child_context"] = context
            system_prompt += "\n\n" + PERSONALIZATION_GUIDANCE + "\n\n" + PERSONALIZATION_PROMPT
        budget = activity_budget_minutes(request.child_context)
        if budget is not None:
            payload["activity_budget_minutes"] = budget
        try:
            raw = await self.llm_client.complete(
                system_prompt=system_prompt,
                user_prompt=json.dumps(payload, ensure_ascii=False),
            )
        except LLMTimeoutError:
            raise
        except LLMError as exc:
            raise ScheduleGenerationError("AI generation failed") from exc

        try:
            plan = ActivityPlan.model_validate_json(raw)
            if len(plan.activities) > request.max_candidates:
                raise ValueError("Too many activities")
            validate_activity_budget(request, plan.activities)
        except (ValueError, TypeError, ValidationError, ScheduleValidationError) as exc:
            raise ScheduleGenerationError("Invalid schedule generation response") from exc
        return plan.activities
