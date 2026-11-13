import re
from datetime import date, datetime, time
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.features.activity_feedback import ChildReaction
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


class ActivityFeedback(ScheduleBase):
    todo_id: int = Field(strict=True, ge=1, le=2**63 - 1)
    plan_name: str = Field(min_length=1, max_length=80)
    date: date
    child_reaction: ChildReaction

    @field_validator("date", mode="before")
    @classmethod
    def iso_date(cls, value):
        if isinstance(value, datetime) or not (
            isinstance(value, date)
            or isinstance(value, str)
            and re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value)
        ):
            raise ValueError("Expected an ISO date")
        return value


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
    activity_feedback: list[ActivityFeedback] = Field(default_factory=list, max_length=50)
    activity_feedback_truncated: bool = Field(default=False, strict=True)

    @model_validator(mode="after")
    def valid_feedback_window(self):
        ids = [item.todo_id for item in self.activity_feedback]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate feedback todo IDs")
        if any(not 1 <= (self.date - item.date).days <= 30 for item in self.activity_feedback):
            raise ValueError("Feedback must come from the thirty days before the recommendation")
        if self.activity_feedback_truncated and len(ids) != 50:
            raise ValueError("Truncated feedback requires a full sample")
        return self


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
