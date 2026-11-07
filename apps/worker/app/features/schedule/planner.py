from pydantic import Field, ValidationError

from app.llm.client import LLMClient
from app.llm.errors import LLMError, LLMTimeoutError

from .prompts.generation import SYSTEM_PROMPT
from .schemas import ActivityProposal, ScheduleBase, ScheduleGenerationRequest


class ScheduleGenerationError(Exception):
    pass


class ActivityPlan(ScheduleBase):
    activities: list[ActivityProposal] = Field(min_length=1, max_length=10)


class SchedulePlanner:
    def __init__(self, llm_client: LLMClient):
        self.llm_client = llm_client

    async def plan(self, request: ScheduleGenerationRequest) -> list[ActivityProposal]:
        try:
            raw = await self.llm_client.complete(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=request.model_dump_json(exclude_none=True),
            )
        except LLMTimeoutError:
            raise
        except LLMError as exc:
            raise ScheduleGenerationError("AI generation failed") from exc

        try:
            plan = ActivityPlan.model_validate_json(raw)
            if len(plan.activities) > request.max_candidates:
                raise ValueError("Too many activities")
        except (ValueError, TypeError, ValidationError) as exc:
            raise ScheduleGenerationError("Invalid schedule generation response") from exc
        return plan.activities
