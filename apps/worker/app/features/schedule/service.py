from .planner import SchedulePlanner
from .scheduler import ScheduleScheduler
from .schemas import ScheduleGenerationRequest, ScheduleGenerationResponse
from .validator import ScheduleValidator, validate_activity_budget


class ScheduleService:
    def __init__(
        self,
        planner: SchedulePlanner,
        scheduler: ScheduleScheduler,
        validator: ScheduleValidator,
    ):
        self.planner = planner
        self.scheduler = scheduler
        self.validator = validator

    async def generate(self, request: ScheduleGenerationRequest) -> ScheduleGenerationResponse:
        activities = await self.planner.plan(request)
        validate_activity_budget(request, activities)
        candidates, unscheduled = self.scheduler.schedule(request, activities)
        result = ScheduleGenerationResponse(
            date=request.date,
            candidates=candidates,
            unscheduled=unscheduled,
        )
        self.validator.validate(request, result)
        return result
