from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ChatBase(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ChatMessage(ChatBase):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ChildContext(ChatBase):
    age_months: int | None = Field(default=None, ge=0, le=47)
    interests: list[str] = Field(default_factory=list, max_length=10)
    concerns: list[str] = Field(default_factory=list, max_length=10)


class DiaryContext(ChatBase):
    diary_id: int = Field(gt=0, strict=True)
    content: str = Field(min_length=1, max_length=1000)


class ChatGenerateRequest(ChatBase):
    message: str = Field(min_length=1)
    history: list[ChatMessage] = Field(default_factory=list)
    child_context: ChildContext | None = None
    diary_context: list[DiaryContext] = Field(default_factory=list, max_length=5)


class ChatGenerateResponse(ChatBase):
    content: str
    model: str
    input_token: int | None = None
    output_tokens: int | None = None
