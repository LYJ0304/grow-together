from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class DiaryActivity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    todo_id: int | None = None
    name: str = Field(min_length=1, max_length=80)
    memo: str | None = Field(default=None, max_length=500)


class DiaryGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: date

    activities: list[DiaryActivity] = Field(default_factory=list, max_length=30)

    memo: str | None = Field(
        default=None,
        max_length=2000,
    )

    tags: list[str] = Field(
        default_factory=list,
        max_length=10,
    )


class GrowthPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str = Field(
        min_length=1,
        max_length=300,
    )

    source_todo_ids: list[int] = Field(
        default_factory=list,
    )


class DiaryGenerationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str = Field(
        min_length=1,
        max_length=1000,
    )

    emotions: list[str] = Field(
        default_factory=list,
        max_length=5,
    )

    growth_points: list[GrowthPoint] = Field(
        default_factory=list,
        max_length=5,
    )

    tomorrow_tip: str | None = Field(
        default=None,
        max_length=300,
    )

    source_todo_ids: list[int] = Field(
        default_factory=list,
    )
