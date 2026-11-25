import asyncio
import json

import httpx
import pytest

from app.features.rag.embeddings import OpenRouterEmbeddings
from app.features.rag.errors import RagEmbeddingError, RagTimeoutError
from app.features.rag.models import DEFAULT_EMBEDDING_MODEL


def response(vectors):
    return {
        "model": DEFAULT_EMBEDDING_MODEL,
        "data": [{"index": i, "embedding": vector} for i, vector in enumerate(vectors)],
    }


def call(body, *, status=200, exception=None):
    requests = []

    def handle(request):
        requests.append(request)
        if exception:
            raise exception
        return httpx.Response(status, content=json.dumps(body).encode())

    client = OpenRouterEmbeddings(
        "fixture-secret", DEFAULT_EMBEDDING_MODEL, transport=httpx.MockTransport(handle)
    )
    result = asyncio.run(client.embed(["첫 문서", "둘째 문서"]))
    return result, requests


def test_validates_embedding_order_model_shape_and_request():
    first, second = [1.0] + [0.0] * 1535, [0.0, 1.0] + [0.0] * 1534
    body = response([first, second])
    body["data"].reverse()
    vectors, requests = call(body)
    assert vectors == [first, second]
    payload = json.loads(requests[0].content)
    assert payload["dimensions"] == 1536
    assert payload["model"] == DEFAULT_EMBEDDING_MODEL
    assert requests[0].url.path == "/api/v1/embeddings"
    assert requests[0].headers["authorization"] == "Bearer fixture-secret"


@pytest.mark.parametrize(
    "kind", ["dimension", "nan", "zero", "duplicate", "model", "missing", "overflow"]
)
def test_bad_provider_output_is_rejected_without_leaking_it(kind):
    body = response([[1.0] + [0.0] * 1535, [1.0] + [0.0] * 1535])
    if kind == "dimension":
        body["data"][0]["embedding"] = [1.0]
    if kind == "nan":
        body["data"][0]["embedding"][0] = float("nan")
    if kind == "zero":
        body["data"][0]["embedding"][0] = 0.0
    if kind == "overflow":
        body["data"][0]["embedding"][0] = 1e100
    if kind == "duplicate":
        body["data"][1]["index"] = 0
    if kind == "model":
        body["model"] = "private-upstream-message"
    if kind == "missing":
        body["data"].pop()
    with pytest.raises(RagEmbeddingError) as caught:
        call(body)
    assert "private-upstream-message" not in str(caught.value)
    assert "fixture-secret" not in str(caught.value)


@pytest.mark.parametrize("status", [401, 429, 500])
def test_provider_errors_are_sanitized(status):
    with pytest.raises(RagEmbeddingError):
        call({"error": "private-body"}, status=status)


def test_timeout_is_distinct():
    with pytest.raises(RagTimeoutError):
        call({}, exception=httpx.ReadTimeout("private"))
