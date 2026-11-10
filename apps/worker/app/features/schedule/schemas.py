from datetime import date, time
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

from app.features.child_context import ChildContext


def validate_local_time(value: time) -> time:
    if value.tzinfo is not None:
        raise ValueError("Time must be local without a UTC offset")
    return value


LocalTime = Annotated[time, AfterValidator(validate_local_time)]


class ScheduleBase(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class TimeWindow(ScheduleBase):
    start: LocalTime
    end: LocalTime

    @model_validator(mode="after")
    def validate_window(self):
        if self.start >= self.end:
            raise ValueError("start must be before end")
        return self


class ExistingSchedule(ScheduleBase):
    todo_id: int
    plan_name: str = Field(min_length=1, max_length=80)
    start: LocalTime
    duration_minutes: int = Field(ge=1, le=1440)

    @model_validator(mode="after")
    def validate_same_day(self):
        seconds = (
            self.start.hour * 3600
            + self.start.minute * 60
            + self.start.second
            + self.start.microsecond / 1_000_000
        )
        if seconds + self.duration_minutes * 60 > 86400:
            raise ValueError("Existing schedule must end within the requested day")
        return self


class ScheduleGenerationRequest(ScheduleBase):
    date: date
    instructions: str = Field(min_length=1, max_length=1000)

    available_windows: list[TimeWindow] = Field(
        min_length=1,
        max_length=10,
    )

    existing_schedules: list[ExistingSchedule] = Field(
        default_factory=list,
        max_length=100,
    )

    max_candidates: int = Field(default=5, ge=1, le=10)
    child_context: ChildContext | None = None


class ActivityProposal(ScheduleBase):
    plan_name: str = Field(min_length=1, max_length=80)
    content: str | None = Field(default=None, max_length=255)
    duration_minutes: int = Field(ge=1, le=1440)
    preferred_time: LocalTime | None = None


class ScheduleCandidate(ScheduleBase):
    plan_name: str = Field(min_length=1, max_length=80)
    content: str | None = Field(default=None, max_length=255)
    scheduled_date: date
    scheduled_time: LocalTime
    duration_minutes: int = Field(ge=1, le=1440)


class ScheduleGenerationResponse(ScheduleBase):
    date: date
    candidates: list[ScheduleCandidate]
    unscheduled: list[ActivityProposal] = Field(
        default_factory=list,
    )
