"""Translate a provider-neutral text stream into AG-UI events."""

import asyncio
from collections.abc import AsyncIterator
from contextlib import aclosing
from uuid import uuid4

from ag_ui.core import (
    PROTOCOL_VERSION,
    RunAgentInput,
    RunErrorEvent,
    RunFinishedEvent,
    RunStartedEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
    TextMessageStartEvent,
)
from ag_ui.encoder import EventEncoder


async def stream_events(input: RunAgentInput, source: AsyncIterator[str]) -> AsyncIterator[str]:
    encoder = EventEncoder()
    message_id = str(uuid4())
    async with aclosing(source):
        yield encoder.encode(
            RunStartedEvent(
                thread_id=input.thread_id,
                run_id=input.run_id,
                protocol_version=PROTOCOL_VERSION,
            )
        )
        yield encoder.encode(TextMessageStartEvent(message_id=message_id, role="assistant"))
        size = 0
        try:
            # Bounds the complete run as well as the provider's per-read timeout.
            async with asyncio.timeout(120):
                async for text in source:
                    if text:
                        size += len(text.encode("utf-16-le")) // 2
                        if size > 4000:
                            raise RuntimeError("Text exceeds conversation limit")
                        yield encoder.encode(
                            TextMessageContentEvent(
                                message_id=message_id,
                                delta=text,
                            )
                        )
            yield encoder.encode(TextMessageEndEvent(message_id=message_id))
            yield encoder.encode(RunFinishedEvent(thread_id=input.thread_id, run_id=input.run_id))
        except Exception:  # noqa: BLE001 -- sanitize every provider failure at the transport boundary
            # Provider errors can contain credentials or request bodies.
            yield encoder.encode(
                RunErrorEvent(
                    code="MODEL_ERROR",
                    message="응답을 생성하지 못했어요. 다시 시도해주세요.",
                )
            )
