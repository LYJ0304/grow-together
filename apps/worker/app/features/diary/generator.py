import json
from typing import Protocol

from pydantic import ValidationError

from app.llm.errors import LLMError

from .prompts.system import SYSTEM_PROMPT
from .schemas import (
    DiaryGenerateRequest,
    DiaryGenerationResponse,
)


class DiaryGenerationError(Exception):
    pass


class LLMClient(Protocol):
    async def complete(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
    ) -> str: ...


class DiaryGenerator:
    def __init__(self, llm_client: LLMClient):
        self.llm_client = llm_client

    async def generate(
        self,
        request: DiaryGenerateRequest,
    ) -> DiaryGenerationResponse:

        user_prompt = request.model_dump_json(exclude_none=True)

        try:
            raw_response = await self.llm_client.complete(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
            )
        except LLMError as exc:
            raise DiaryGenerationError("AI generation failed") from exc

        try:
            data = json.loads(raw_response)

            return DiaryGenerationResponse.model_validate(data)

        except (ValueError, TypeError, ValidationError) as exc:
            raise DiaryGenerationError("Invalid diary generation response") from exc
