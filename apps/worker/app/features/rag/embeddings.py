import asyncio
import json
import math
import struct

import httpx
from pydantic import SecretStr

from .errors import RagEmbeddingError, RagTimeoutError
from .models import DIMENSIONS


def validate_vector(values):
    if not isinstance(values, list) or len(values) != DIMENSIONS:
        raise RagEmbeddingError("Invalid embedding dimensions")
    rounded = []
    try:
        for value in values:
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise TypeError
            value = struct.unpack("f", struct.pack("f", value))[0]
            if not math.isfinite(value):
                raise ValueError
            rounded.append(value)
        if not any(rounded):
            raise ValueError
    except (ValueError, TypeError, OverflowError, struct.error):
        raise RagEmbeddingError("Invalid embedding values") from None
    return rounded


class OpenRouterEmbeddings:
    def __init__(self, api_key, model, transport=None):
        self.api_key = SecretStr(api_key)
        self.model = model
        self.transport = transport

    async def embed(self, texts):
        if not 1 <= len(texts) <= 16 or any(
            not isinstance(text, str) or not text.strip() or len(text.encode("utf-8")) > 8000
            for text in texts
        ):
            raise RagEmbeddingError("Invalid embedding batch")
        try:
            async with (
                asyncio.timeout(25),
                httpx.AsyncClient(timeout=20, transport=self.transport) as client,
                client.stream(
                    "POST",
                    "https://openrouter.ai/api/v1/embeddings",
                    headers={"Authorization": f"Bearer {self.api_key.get_secret_value()}"},
                    json={
                        "model": self.model,
                        "dimensions": DIMENSIONS,
                        "encoding_format": "float",
                        "input": texts,
                    },
                ) as response,
            ):
                if not response.is_success:
                    raise RagEmbeddingError("Embedding request failed")
                data = bytearray()
                async for chunk in response.aiter_bytes():
                    if len(data) + len(chunk) > 2 * 1024 * 1024:
                        raise RagEmbeddingError("Embedding response too large")
                    data.extend(chunk)
        except (httpx.TimeoutException, TimeoutError):
            raise RagTimeoutError("Embedding request timed out") from None
        except httpx.HTTPError:
            raise RagEmbeddingError("Embedding request failed") from None
        try:
            body = json.loads(data)
            if body["model"] not in {self.model, self.model.removeprefix("openai/")}:
                raise ValueError
            rows = body["data"]
            if not isinstance(rows, list) or len(rows) != len(texts):
                raise ValueError
            indexes = [row["index"] for row in rows]
            if any(type(index) is not int for index in indexes) or sorted(indexes) != list(
                range(len(texts))
            ):
                raise ValueError
            rows = sorted(rows, key=lambda row: row["index"])
            return [validate_vector(row["embedding"]) for row in rows]
        except (ValueError, KeyError, TypeError):
            raise RagEmbeddingError("Invalid embedding response") from None
