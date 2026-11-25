"""Opt-in integration against the disposable DB initialized by infra/tests."""

import asyncio
import hashlib
import json
import os
import subprocess
from types import SimpleNamespace
from uuid import uuid4

import httpx
import psycopg
import pytest
from pydantic import SecretStr

from app.features.rag.errors import RagConflictError, RagStorageError
from app.features.rag.ingestion import Ingestor
from app.features.rag.models import CollectionSpec, Document, QueryRequest
from app.features.rag.service import RagService
from app.features.rag.storage import RagRepository, create_pool

pytestmark = pytest.mark.skipif(
    not os.getenv("RAG_TEST_CONTAINER"),
    reason="Requires disposable pgvector fixture and loopback test port",
)


class FixtureEmbeddings:
    def __init__(self):
        self.calls = 0

    async def embed(self, texts):
        self.calls += 1
        return [([1.0, 0.0] if "책" in text else [0.0, 1.0]) + [0.0] * 1534 for text in texts]


def url(role):
    container = os.environ["RAG_TEST_CONTAINER"]
    assert container.startswith("rag-239-test")
    port = subprocess.check_output(["docker", "port", container, "5432/tcp"], text=True).strip()
    assert port.startswith("127.0.0.1:")
    passwords = {
        "rag_reader": "test-reader-only",
        "rag_ingest": "test-ingest-only",
        "rag_migrator": "test-migrator-only",
    }
    return f"postgresql://{role}:{passwords[role]}@{port}/growtogether_rag"


async def with_repositories(test):
    writer = create_pool(url("rag_ingest"), "rag_ingest")
    reader = create_pool(url("rag_reader"), "rag_reader")
    name = "fixture-" + uuid4().hex[:12]
    await writer.open()
    await reader.open()
    try:
        await test(RagRepository(writer), RagRepository(reader), name, writer)
    finally:
        async with writer.connection() as connection:
            await connection.execute("DELETE FROM rag.documents WHERE collection_name=%s", (name,))
            await connection.execute("DELETE FROM rag.collections WHERE name=%s", (name,))
        await writer.close()
        await reader.close()
    assert writer.closed and reader.closed


def document(collection, text="책을 함께 읽어요.", document_id="book"):
    return Document(
        collection=collection,
        document_id=document_id,
        title="Fixture only",
        source="fixture://not-production",
        text=text,
    )


def test_real_ingestion_search_generation_and_idempotency(worker_app, monkeypatch):
    async def scenario(writer, reader, name, pool):
        embeddings = FixtureEmbeddings()
        ingestor = Ingestor(writer, embeddings, CollectionSpec())
        assert await ingestor.ingest(document(name)) == "updated"
        assert await ingestor.ingest(document(name)) == "unchanged"
        assert embeddings.calls == 1
        assert await ingestor.ingest(document(name, "다른 활동을 해요.", "other")) == "updated"
        hits = await reader.search(name, [1.0] + [0.0] * 1535, 2)
        assert [hit.document_id for hit in hits] == ["book", "other"]
        assert hits[0].similarity == pytest.approx(1.0)
        assert hits[1].similarity == pytest.approx(0.0)
        assert await reader.search("missing-fixture", [1.0] + [0.0] * 1535, 4) == []

        async def complete(**kwargs):
            payload = json.loads(kwargs["user_prompt"])
            assert len(payload["sources"]) == 1
            assert payload["sources"][0]["document_id"] == "book"
            return '{"content":"책을 읽어요. [S1]","references":["S1"]}'

        service = RagService(
            reader,
            embeddings,
            SimpleNamespace(model="fixture/generator", complete=complete),
            CollectionSpec(),
        )
        answer = await service.query(QueryRequest(collection=name, question="책을 읽을까요?"))
        assert answer.status == "answered"
        assert answer.sources[0].revision == hits[0].revision
        from app.features.rag import runtime

        monkeypatch.setattr(runtime.settings, "rag_enabled", True)
        monkeypatch.setattr(runtime.settings, "rag_database_url", SecretStr(url("rag_reader")))
        monkeypatch.setattr(runtime, "OpenRouterEmbeddings", lambda *_: embeddings)
        monkeypatch.setattr(
            runtime,
            "OpenRouterClient",
            lambda **_: SimpleNamespace(model="fixture/generator", complete=complete),
        )
        async with worker_app.router.lifespan_context(worker_app):
            runtime_pool = worker_app.state.rag_service.repository.pool
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=worker_app), base_url="http://worker"
            ) as client:
                response = await client.post(
                    "/internal/v1/rag/query",
                    headers={"X-API-Key": "test-worker-key"},
                    json={"collection": name, "question": "책을 읽을까요?"},
                )
                assert response.status_code == 200
                assert response.json()["sources"][0]["revision"] == hits[0].revision
                assert response.json()["sources"][0]["collection"] == name
        assert runtime_pool.closed
        assert worker_app.state.rag_service is None
        async with pool.connection() as connection:
            count = await (
                await connection.execute(
                    "SELECT count(*) AS count FROM rag.chunks WHERE collection_name=%s", (name,)
                )
            ).fetchone()
            assert count["count"] == 2

    asyncio.run(with_repositories(scenario))


def test_real_failed_replacement_rolls_back_and_stale_writes_conflict():
    async def scenario(writer, reader, name, pool):
        embeddings = FixtureEmbeddings()
        spec = CollectionSpec()
        ingestor = Ingestor(writer, embeddings, spec)
        original = document(name)
        await ingestor.ingest(original)
        before = await reader.document(name, "book")
        async with await psycopg.AsyncConnection.connect(
            url("rag_migrator"), autocommit=True
        ) as admin:
            await admin.execute(
                "ALTER TABLE rag.chunks ADD CONSTRAINT fixture_reject CHECK (body <> 'reject-fixture')"
            )
            try:
                with pytest.raises(RagStorageError):
                    await ingestor.ingest(document(name, "reject-fixture"))
                assert await reader.document(name, "book") == before
                assert (await reader.search(name, [1.0] + [0.0] * 1535, 1))[0].text == original.text
            finally:
                await admin.execute("ALTER TABLE rag.chunks DROP CONSTRAINT fixture_reject")
        await ingestor.ingest(document(name, "책을 다시 읽어요."))
        with pytest.raises(RagConflictError):
            await writer.replace(
                document=original,
                spec=spec,
                content_hash=hashlib.sha256(original.text.encode()).hexdigest(),
                expected_revision=before.revision,
                chunks=[original.text],
                vectors=[[1.0] + [0.0] * 1535],
            )

    asyncio.run(with_repositories(scenario))


def test_cli_uses_only_ingest_credentials_without_generation_settings(
    tmp_path, monkeypatch, capsys
):
    from app.features.rag import cli

    name = "fixture-" + uuid4().hex[:12]
    path = tmp_path / "fixture.txt"
    path.write_text("책을 읽어요.", encoding="utf-8")
    monkeypatch.setenv("OPENROUTER_API_KEY", "fixture-api-secret")
    monkeypatch.setenv("RAG_INGEST_DATABASE_URL", url("rag_ingest"))
    for field in ["LLM_CHAT_MODEL", "LLM_DIARY_MODEL", "AI_WORKER_API_KEY"]:
        monkeypatch.delenv(field, raising=False)
    embeddings = FixtureEmbeddings()
    monkeypatch.setattr(cli, "OpenRouterEmbeddings", lambda *_: embeddings)
    args = [
        "--collection",
        name,
        "--document-id",
        "book",
        "--title",
        "Fixture",
        "--source",
        "fixture://one",
        "--file",
        str(path),
    ]
    try:
        assert cli.main(args) == 0
        assert json.loads(capsys.readouterr().out)["status"] == "updated"
        assert cli.main(args) == 0
        assert json.loads(capsys.readouterr().out)["status"] == "unchanged"
        assert embeddings.calls == 1
        monkeypatch.setenv("RAG_INGEST_DATABASE_URL", url("rag_reader"))
        assert cli.main(args) == 2
        error = capsys.readouterr().err
        assert "RagConfigurationError" in error
        assert "fixture-api-secret" not in error and "test-reader-only" not in error
    finally:
        with psycopg.connect(url("rag_ingest"), autocommit=True) as connection:
            connection.execute("DELETE FROM rag.documents WHERE collection_name=%s", (name,))
            connection.execute("DELETE FROM rag.collections WHERE name=%s", (name,))
