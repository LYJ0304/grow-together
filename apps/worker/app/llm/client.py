from typing import Protocol

import httpx
from openrouter import OpenRouter
from openrouter.errors import OpenRouterError

from app.llm.errors import LLMError, LLMTimeoutError


class LLMClient(Protocol):
    async def complete(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
    ) -> str: ...


class OpenRouterClient:
    def __init__(self, *, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    async def complete(self, *, system_prompt: str, user_prompt: str) -> str:
        try:
            async with OpenRouter(api_key=self.api_key, timeout_ms=30_000) as sdk:
                response = await sdk.chat.send_async(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    response_format={"type": "json_object"},
                    stream=False,
                    retries=None,
                )
        except httpx.TimeoutException as exc:
            raise LLMTimeoutError("LLM request failed") from exc
        except (OpenRouterError, httpx.HTTPError) as exc:
            raise LLMError("LLM request failed") from exc

        content = response.choices[0].message.content if response.choices else None
        if not isinstance(content, str) or not content.strip():
            raise LLMError("Empty LLM response")
        return content
