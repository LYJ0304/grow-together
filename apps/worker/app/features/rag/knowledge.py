"""Bounded, pre-chunked knowledge inputs; no database or provider dependencies."""

from datetime import date
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator


class KnowledgeMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, str_strip_whitespace=True)
    source_id: str = Field(min_length=1, max_length=200)
    source_name: str = Field(min_length=1, max_length=300)
    source_url: HttpUrl = Field(max_length=1000)
    source_file: str = Field(min_length=1, max_length=300)
    source_pages: list[int] = Field(min_length=1, max_length=100)
    source_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    age_months: int | None = Field(ge=0, le=240, strict=True)
    applicable_age_months: list[int] | None = Field(default=None, min_length=1, max_length=241)
    chunk_type: Literal["milestone", "parenting_guidance", "screening", "reference_guidance"]
    topic: str = Field(min_length=1, max_length=100)
    language: str = Field(min_length=2, max_length=20)
    source_language: str = Field(min_length=2, max_length=20)
    source_locale: str = Field(min_length=2, max_length=20)
    translation_status: str = Field(min_length=1, max_length=100)
    review_status: str = Field(min_length=1, max_length=100)
    source_pdf_modified_date: date | None = None

    @field_validator("source_pages", "applicable_age_months", mode="before")
    @classmethod
    def valid_numbers(cls, values, info):
        if values is None:
            return values
        minimum, maximum = (1, 10000) if info.field_name == "source_pages" else (0, 240)
        if (
            not isinstance(values, list)
            or not values
            or any(type(v) is not int or not minimum <= v <= maximum for v in values)
            or values != sorted(set(values))
        ):
            raise ValueError("Expected sorted unique integers in range")
        return values

    @model_validator(mode="after")
    def common_guidance(self):
        if self.age_months is None and self.chunk_type == "milestone":
            raise ValueError("Milestones require a checklist age")
        if self.age_months is not None and self.applicable_age_months is not None:
            raise ValueError("Age ranges are only for common guidance")
        return self


class KnowledgeRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$")
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=2000)
    metadata: KnowledgeMetadata

    @field_validator("title", "content")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Blank knowledge content")
        value.encode("utf-8")
        return value


def load_knowledge(path: Path, collection: str):
    """Validate the entire bounded file before any paid call or database write."""
    from .models import Document

    with path.open("rb") as source:
        raw = source.read(5_000_001)
    if len(raw) > 5_000_000:
        raise ValueError("Knowledge file exceeds 5 MB")
    lines = raw.decode("utf-8").splitlines()
    if not 1 <= len(lines) <= 2000:
        raise ValueError("Expected 1–2000 JSONL records")
    documents, seen = [], set()
    for number, line in enumerate(lines, 1):
        try:
            row = KnowledgeRecord.model_validate_json(line)
            if row.id in seen:
                raise ValueError("Duplicate knowledge ID")
            seen.add(row.id)
            documents.append(
                Document(
                    collection=collection,
                    document_id=row.id,
                    title=row.title,
                    source=str(row.metadata.source_url),
                    text=row.content,
                    metadata=row.metadata,
                )
            )
        except (ValueError, UnicodeError):
            raise ValueError(f"Invalid knowledge record at line {number}") from None
    return documents


def metadata_json(metadata):
    return metadata.model_dump(mode="json") if metadata is not None else None
