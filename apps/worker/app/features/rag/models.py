from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small"
DIMENSIONS = 1536


class CollectionSpec(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    embedding_model: str = Field(default=DEFAULT_EMBEDDING_MODEL, min_length=1, max_length=200)
    dimensions: Literal[1536] = DIMENSIONS
    distance_metric: Literal["cosine"] = "cosine"
    chunk_size: int = Field(default=800, ge=1, le=2000)
    chunk_overlap: int = Field(default=120, ge=0)

    @model_validator(mode="after")
    def valid_overlap(self):
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("Overlap must be smaller than chunk size")
        return self


@dataclass(frozen=True)
class CollectionState:
    spec: CollectionSpec
    has_chunks: bool


@dataclass(frozen=True)
class DocumentState:
    revision: str
    content_hash: str
    title: str
    source: str


class Document(BaseModel):
    model_config = ConfigDict(extra="forbid")
    collection: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")
    document_id: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")
    title: str = Field(min_length=1, max_length=200)
    source: str = Field(min_length=1, max_length=1000)
    text: str = Field(min_length=1, max_length=100_000)

    @field_validator("title", "source")
    @classmethod
    def nonblank_metadata(cls, value):
        if not value.strip():
            raise ValueError("Metadata must not be blank")
        return value.strip()


class RetrievedChunk(BaseModel):
    model_config = ConfigDict(frozen=True, allow_inf_nan=False)
    document_id: str
    ordinal: int = Field(ge=0)
    revision: str
    title: str
    source: str
    text: str
    similarity: float = Field(ge=-1, le=1)


class QueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    collection: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")
    question: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=4, ge=1, le=10, strict=True)

    @field_validator("question")
    @classmethod
    def nonblank_question(cls, value):
        if not value.strip():
            raise ValueError("Question must not be blank")
        try:
            value.encode("utf-8")
        except UnicodeError:
            raise ValueError("Question must be valid UTF-8") from None
        return value.strip()


class Citation(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    reference_id: str = Field(pattern=r"^S(?:[1-9]|10)$")
    collection: str
    document_id: str
    revision: str
    ordinal: int = Field(ge=0, le=159)
    title: str = Field(max_length=200)
    source: str = Field(max_length=1000)
    excerpt: str = Field(min_length=1, max_length=2000)
    similarity: float = Field(ge=-1, le=1)


class GeneratedAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content: str = Field(min_length=1, max_length=6000)
    references: list[str] = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def valid_answer(self):
        if not self.content.strip() or len(set(self.references)) != len(self.references):
            raise ValueError("Invalid grounded answer")
        return self


class QueryResponse(BaseModel):
    status: Literal["answered", "no_context"]
    reason: Literal["collection_not_found", "no_documents", "no_relevant_chunks"] | None = None
    content: str | None = Field(default=None, max_length=6000)
    model: str | None = None
    sources: list[Citation] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def consistent_status(self):
        if self.status == "answered":
            if not self.content or not self.model or not self.sources or self.reason is not None:
                raise ValueError("Incomplete RAG answer")
        elif (
            self.content is not None
            or self.model is not None
            or self.sources
            or self.reason is None
        ):
            raise ValueError("Invalid no-context result")
        return self
