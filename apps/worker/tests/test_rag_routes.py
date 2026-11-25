import asyncio
from functools import partial

import httpx


def test_rag_endpoint_requires_service_key(worker_app):
    async def send():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=worker_app), base_url="http://worker"
        ) as client:
            return await client.post(
                "/internal/v1/rag/query",
                json={"collection": "parenting", "question": "책을 읽을까요?"},
            )

    assert asyncio.run(send()).status_code == 401


def post(app, payload=None, content=None):
    async def send():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://worker"
        ) as client:
            return await client.post(
                "/internal/v1/rag/query",
                json=payload,
                content=content,
                headers={"X-API-Key": "test-worker-key"},
            )

    return asyncio.run(send())


def test_disabled_returns_unavailable_without_provider_or_db(worker_app):
    response = post(worker_app, {"collection": "parenting", "question": "책을 읽을까요?"})
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "RAG_UNAVAILABLE"


def test_validation_body_limit_and_openapi(worker_app):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    from app.features.rag.models import QueryResponse
    from app.features.rag.runtime import get_rag_service

    service = SimpleNamespace(
        query=AsyncMock(return_value=QueryResponse(status="no_context", reason="no_documents"))
    )
    worker_app.dependency_overrides[get_rag_service] = partial(lambda value: value, service)
    assert (
        post(worker_app, {"collection": "parenting", "question": "책"}).json()["status"]
        == "no_context"
    )
    service.query.reset_mock()
    for payload in [
        {"collection": "x", "question": " "},
        {"collection": "x", "question": "x" * 2001},
        {"collection": "x", "question": "책", "top_k": 11},
        {"collection": "x", "question": "책", "top_k": True},
        {"collection": "x", "question": "책", "unexpected": "input"},
    ]:
        assert post(worker_app, payload).status_code == 422

    async def chunks():
        yield b"{" + b"x" * 9000
        yield b"x" * 9000

    assert post(worker_app, content=chunks()).status_code == 413
    assert post(worker_app, content=b'{"collection":"x","question":"\\ud800"}').status_code == 422
    service.query.assert_not_called()
    operation = worker_app.openapi()["paths"]["/internal/v1/rag/query"]["post"]
    assert operation["security"] == [{"APIKeyHeader": []}]
    assert {"200", "408", "409", "413", "422", "502", "503", "504"} <= operation["responses"].keys()


def test_error_stages_are_distinct_and_sanitized(worker_app):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    from app.features.rag.errors import (
        RagCollectionError,
        RagEmbeddingError,
        RagGenerationError,
        RagStorageError,
        RagTimeoutError,
    )
    from app.features.rag.runtime import get_rag_service
    from app.llm.errors import LLMError, LLMTimeoutError

    for error, status, code in [
        (RagStorageError, 503, "RAG_STORAGE_UNAVAILABLE"),
        (RagCollectionError, 409, "RAG_COLLECTION_MISMATCH"),
        (RagEmbeddingError, 502, "RAG_EMBEDDING_FAILED"),
        (RagGenerationError, 502, "RAG_GENERATION_FAILED"),
        (RagTimeoutError, 504, "RAG_TIMEOUT"),
        (LLMError, 502, "RAG_GENERATION_FAILED"),
        (LLMTimeoutError, 504, "RAG_TIMEOUT"),
    ]:
        service = SimpleNamespace(query=AsyncMock(side_effect=error("private-source-password")))
        worker_app.dependency_overrides[get_rag_service] = partial(lambda value: value, service)
        response = post(worker_app, {"collection": "parenting", "question": "private-question"})
        assert response.status_code == status
        assert response.json()["detail"]["code"] == code
        assert "private-" not in response.text


def test_knowledge_filters_are_validated_and_described_in_openapi(worker_app):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    from app.features.rag.models import QueryResponse
    from app.features.rag.runtime import get_rag_service

    service = SimpleNamespace(
        query=AsyncMock(
            return_value=QueryResponse(status="no_context", reason="no_relevant_chunks")
        )
    )
    worker_app.dependency_overrides[get_rag_service] = lambda: service
    assert (
        post(
            worker_app,
            {
                "collection": "cdc",
                "question": "발달",
                "filters": {"age_months": 5, "chunk_type": "milestone", "topic": "cognitive"},
            },
        ).status_code
        == 200
    )
    assert service.query.call_args.args[0].filters.age_months == 5
    for filters in [
        {"age_months": -1},
        {"age_months": True},
        {"chunk_type": "unknown"},
        {"topic": ""},
        {"unknown": 1},
    ]:
        assert (
            post(
                worker_app, {"collection": "cdc", "question": "발달", "filters": filters}
            ).status_code
            == 422
        )
    assert (
        post(
            worker_app, content=b'{"collection":"cdc","question":"x","filters":{"topic":"\\ud800"}}'
        ).status_code
        == 422
    )
    schemas = worker_app.openapi()["components"]["schemas"]
    assert "filters" in schemas["QueryRequest"]["properties"]
    assert "metadata" in schemas["Citation"]["properties"]
    assert "source_pages" in schemas["KnowledgeMetadata"]["properties"]
