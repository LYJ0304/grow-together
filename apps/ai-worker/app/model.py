"""OpenAI-compatible text provider; AG-UI and domain policy live outside this module."""

from collections.abc import AsyncIterator

from openai import AsyncOpenAI, Timeout

from app.core.config import settings


async def stream_text(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    async with AsyncOpenAI(
        api_key=settings.model_api_key,
        base_url=settings.model_base_url,
        max_retries=0,
        timeout=Timeout(30, connect=5),
    ) as client:
        stream = await client.chat.completions.create(
            model=settings.model_name,
            messages=messages,
            stream=True,
        )
        async with stream:
            finished = False
            async for chunk in stream:
                if not chunk.choices:
                    continue
                choice = chunk.choices[0]
                if choice.delta.content:
                    yield choice.delta.content
                if choice.finish_reason:
                    if choice.finish_reason != "stop":
                        raise RuntimeError("Incomplete text response")
                    finished = True
            if not finished:
                raise RuntimeError("Provider stream ended before completion")
