"""API-owned weekly-v1/v2 wire types; metrics remain authoritative API data."""

import re
from collections import Counter
from datetime import date, datetime, time, timedelta
from math import isclose
from typing import Annotated, Literal, Self
from zoneinfo import ZoneInfo

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator, model_validator

from app.features.activity_feedback import ChildReaction

Count = Annotated[int, Field(strict=True, ge=0, le=2**63 - 1)]
Identifier = Annotated[int, Field(strict=True, ge=1, le=2**63 - 1)]
Hash = Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
Text80 = Annotated[str, Field(min_length=1, max_length=80, pattern=r"\S")]
Text240 = Annotated[str, Field(min_length=1, max_length=240, pattern=r"\S")]
SEOUL = ZoneInfo("Asia/Seoul")


def iso_date(value):
    if not isinstance(value, date) and (
        not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value)
    ):
        raise ValueError("Expected an ISO date")
    return value


def local_time(value):
    if not isinstance(value, time) and (
        not isinstance(value, str)
        or not re.fullmatch(r"[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?", value)
    ):
        raise ValueError("Expected local time with seconds")
    return value


ISODate = Annotated[date, BeforeValidator(iso_date)]
LocalTime = Annotated[time, BeforeValidator(local_time)]


class WireModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    @field_validator("*")
    @classmethod
    def valid_unicode(cls, value):
        if isinstance(value, str):
            value.encode("utf-8")
        return value


class Period(WireModel):
    start: ISODate
    end: ISODate
    end_exclusive: ISODate
    as_of: datetime
    current: Annotated[bool, Field(strict=True)]

    @field_validator("as_of", mode="before")
    @classmethod
    def offset_datetime(cls, value):
        if not isinstance(value, datetime) and (
            not isinstance(value, str)
            or not re.fullmatch(
                r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}"
                r"(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})",
                value,
            )
        ):
            raise ValueError("Expected offset date-time")
        return value

    @model_validator(mode="after")
    def coherent_week(self) -> Self:
        if self.as_of.utcoffset() is None:
            raise ValueError("as_of requires an offset")
        today = self.as_of.astimezone(SEOUL).date()
        current_start = today - timedelta(days=today.weekday())
        if (
            self.start.year > 9998
            or self.start.weekday() != 0
            or self.end != self.start + timedelta(days=6)
            or self.end_exclusive != self.start + timedelta(days=7)
            or self.start > current_start
            or self.current != (self.start == current_start)
        ):
            raise ValueError("Invalid report week")
        return self


class Daily(WireModel):
    date: ISODate
    completed: Count


class Metrics(WireModel):
    planned: Count
    eligible: Count
    completed: Count
    diary_days: Annotated[int, Field(strict=True, ge=0, le=7)]
    completion_rate: Annotated[float, Field(strict=True, ge=0, le=1)] | None
    daily: Annotated[list[Daily], Field(min_length=7, max_length=7)]

    @model_validator(mode="after")
    def coherent_counts(self) -> Self:
        if not self.completed <= self.eligible <= self.planned:
            raise ValueError("Invalid counts")
        if sum(day.completed for day in self.daily) != self.completed:
            raise ValueError("Daily count mismatch")
        if self.eligible == 0:
            if self.completion_rate is not None:
                raise ValueError("Rate must be null without eligible activities")
        elif self.completion_rate is None or not isclose(
            self.completion_rate, self.completed / self.eligible, abs_tol=1e-9
        ):
            raise ValueError("Rate mismatch")
        return self


class ReportChildContext(WireModel):
    age_months: Annotated[int, Field(strict=True, ge=0, le=72)]
    age_as_of: ISODate
    concern_codes: Annotated[
        list[
            Literal[
                "sleep",
                "feeding",
                "emotion_expression",
                "communication",
                "developmental_play",
                "daily_habits",
                "separation_anxiety",
                "none",
            ]
        ],
        Field(max_length=2),
    ]
    available_activity_time: Literal["5min", "10min", "15to20min", "flexible"] | None

    @model_validator(mode="after")
    def unique_concerns(self) -> Self:
        if len(set(self.concern_codes)) != len(self.concern_codes):
            raise ValueError("Duplicate concerns")
        return self


class Todo(WireModel):
    id: Identifier
    title: Text80
    date: ISODate
    time: LocalTime
    child_reaction: ChildReaction | None = None


class Diary(WireModel):
    id: Identifier
    date: ISODate
    excerpt: Text240


class Sources(WireModel):
    todos: Annotated[list[Todo], Field(max_length=50)]
    diaries: Annotated[list[Diary], Field(max_length=7)]
    todos_truncated: Annotated[bool, Field(strict=True)]


class ReportRequest(WireModel):
    source_hash: Hash
    prompt_version: Literal["weekly-v1", "weekly-v2"]
    period: Period
    metrics: Metrics
    child_context: ReportChildContext
    sources: Sources

    @model_validator(mode="after")
    def coherent_evidence(self) -> Self:
        period, metrics, sources = self.period, self.metrics, self.sources
        if self.prompt_version == "weekly-v1" and any(
            todo.child_reaction is not None for todo in sources.todos
        ):
            raise ValueError("Activity reactions require weekly-v2")
        today = period.as_of.astimezone(SEOUL).date()
        cutoff = min(today, period.end)
        expected_dates = [period.start + timedelta(days=i) for i in range(7)]
        if [day.date for day in metrics.daily] != expected_dates:
            raise ValueError("Daily dates must cover the ordered week")
        if self.child_context.age_as_of != cutoff:
            raise ValueError("Age reference date mismatch")
        if any(day.completed for day in metrics.daily if day.date > cutoff):
            raise ValueError("Future completed activities")
        if not sources.todos and not sources.diaries:
            raise ValueError("No report evidence")
        for records in (sources.todos, sources.diaries):
            if len({record.id for record in records}) != len(records):
                raise ValueError("Duplicate source identifiers")
            if any(not period.start <= record.date <= cutoff for record in records):
                raise ValueError("Source date outside observed period")
        if len({diary.date for diary in sources.diaries}) != len(sources.diaries):
            raise ValueError("Duplicate diary dates")
        if (
            len(sources.diaries) > metrics.diary_days
            or metrics.diary_days > (cutoff - period.start).days + 1
        ):
            raise ValueError("Diary day mismatch")
        if len(sources.todos) != min(50, metrics.completed) or sources.todos_truncated != (
            metrics.completed > 50
        ):
            raise ValueError("Todo sample size mismatch")
        counts = Counter(todo.date for todo in sources.todos)
        if any(counts[day.date] > day.completed for day in metrics.daily):
            raise ValueError("Todo sample exceeds daily count")
        for todo in sources.todos:
            if todo.time.utcoffset() is not None:
                raise ValueError("Todo time must be local")
            if datetime.combine(todo.date, todo.time, SEOUL) > period.as_of:
                raise ValueError("Todo has not become eligible")
        return self


class Evidence(WireModel):
    type: Literal["TODO", "DIARY"]
    id: Identifier


EvidenceList = Annotated[list[Evidence], Field(min_length=1, max_length=5)]


class Observation(WireModel):
    text: Annotated[str, Field(min_length=1, max_length=300, pattern=r"\S")]
    evidence: EvidenceList


class NextStep(WireModel):
    title: Text80
    description: Annotated[str, Field(min_length=1, max_length=255, pattern=r"\S")]
    reason: Text240
    evidence: EvidenceList


class ReportResult(WireModel):
    summary: Annotated[str, Field(min_length=1, max_length=500, pattern=r"\S")]
    observations: Annotated[list[Observation], Field(min_length=1, max_length=3)]
    next_steps: Annotated[list[NextStep], Field(min_length=1, max_length=2)]


class ReportResponse(WireModel):
    source_hash: Hash
    prompt_version: Literal["weekly-v1", "weekly-v2"]
    result: ReportResult
