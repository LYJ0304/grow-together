import asyncio
import json

from pydantic import ValidationError

from app.llm.client import LLMClient

from .prompts.generation import REACTION_GUIDANCE, SYSTEM_PROMPT
from .schemas import ReportRequest, ReportResult
from .validator import ReportValidationError

MAX_RESPONSE_BYTES = 32 * 1024
GENERATION_TIMEOUT_SECONDS = 30


def unique_object(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


class ReportGenerator:
    def __init__(self, llm_client: LLMClient):
        self.llm_client = llm_client

    async def generate(self, request: ReportRequest) -> ReportResult:
        prompt = SYSTEM_PROMPT
        exclude = None
        if request.prompt_version == "weekly-v2":
            prompt += "\n\n" + REACTION_GUIDANCE
        else:
            # Keep the legacy model payload unchanged during Worker-first rollout.
            exclude = {"sources": {"todos": {"__all__": {"child_reaction"}}}}
        # An outer deadline also bounds alternative LLMClient implementations.
        async with asyncio.timeout(GENERATION_TIMEOUT_SECONDS):
            raw = await self.llm_client.complete(
                system_prompt=prompt, user_prompt=request.model_dump_json(exclude=exclude)
            )
        try:
            if not isinstance(raw, str) or len(raw.encode("utf-8")) > MAX_RESPONSE_BYTES:
                raise ValueError("Oversized report result")
            data = json.loads(raw, object_pairs_hook=unique_object)
            return ReportResult.model_validate(data)
        except (ValueError, TypeError, ValidationError) as exc:
            raise ReportValidationError("Invalid AI report result") from exc
