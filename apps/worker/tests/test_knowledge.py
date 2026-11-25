import asyncio
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from app.features.rag.ingestion import Ingestor
from app.features.rag.knowledge import load_knowledge
from app.features.rag.models import CollectionSpec, DocumentState

DATA = Path(__file__).parents[1] / "knowledge/cdc/cdc_milestones_ko.jsonl"


def test_dataset_parses_without_rechunking_and_preserves_metadata():
    records = load_knowledge(DATA, "cdc")
    assert len(records) == 92
    assert len({r.document_id for r in records}) == 92
    assert sum(r.metadata.chunk_type == "milestone" for r in records) == 48
    assert records[0].document_id == "cdc_ltsae_milestone_checklists:02m:milestone:social_emotional"
    assert records[0].metadata.source_pages == [1, 2]
    assert records[-1].metadata.applicable_age_months == [36, 48, 60]


@pytest.mark.parametrize(
    "field,value",
    [
        ("source_pages", []),
        ("age_months", -1),
        ("source_sha256", "bad"),
        ("source_url", "file:///bad"),
        ("chunk_type", "unknown"),
        ("review_status", ""),
        ("source_name", "\ud800"),
        ("age_months", True),
    ],
)
def test_invalid_metadata_rejected_before_embedding(tmp_path, field, value):
    row = json.loads(DATA.read_text().splitlines()[0])
    row["metadata"][field] = value
    path = tmp_path / "bad.jsonl"
    path.write_text(json.dumps(row))
    with pytest.raises((ValidationError, ValueError)):
        load_knowledge(path, "cdc")


def test_duplicate_ids_and_late_invalid_rows_are_rejected(tmp_path):
    row = DATA.read_text().splitlines()[0]
    path = tmp_path / "bad.jsonl"
    for content in [row + "\n" + row, row + "\n{invalid"]:
        path.write_text(content)
        with pytest.raises(ValueError):
            load_knowledge(path, "cdc")


def test_prechunked_ingestion_is_idempotent_and_metadata_updates_skip_embedding():
    async def scenario():
        document = load_knowledge(DATA, "cdc")[0]
        repository = SimpleNamespace(
            collection=AsyncMock(return_value=None),
            document=AsyncMock(return_value=None),
            replace=AsyncMock(return_value=True),
            update_metadata=AsyncMock(return_value=True),
        )
        embeddings = SimpleNamespace(embed=AsyncMock(return_value=[[1.0] + [0.0] * 1535]))
        ingestor = Ingestor(repository, embeddings, CollectionSpec(chunking_mode="prechunked"))
        assert await ingestor.ingest(document) == "updated"
        embeddings.embed.assert_awaited_once_with([document.text])
        assert repository.replace.call_args.kwargs["chunks"] == [document.text]
        repository.document.return_value = DocumentState(
            "revision",
            hashlib.sha256(document.text.encode()).hexdigest(),
            document.title,
            document.source,
            document.metadata,
        )
        assert await ingestor.ingest(document) == "unchanged"
        changed = document.model_copy(
            update={"metadata": document.metadata.model_copy(update={"review_status": "reviewed"})}
        )
        assert await ingestor.ingest(changed) == "updated"
        assert embeddings.embed.await_count == 1
        repository.update_metadata.assert_awaited_once()

    asyncio.run(scenario())


def test_retriever_accepts_prechunked_storage_and_passes_filters():
    from app.features.rag.models import CollectionState, QueryRequest, RetrievalFilters
    from app.features.rag.retrieval import RagRetriever

    async def scenario():
        filters = RetrievalFilters(age_months=5, chunk_type="milestone", topic="cognitive")
        repository = SimpleNamespace(
            collection=AsyncMock(
                return_value=CollectionState(CollectionSpec(chunking_mode="prechunked"), True)
            ),
            search=AsyncMock(return_value=[]),
        )
        embeddings = SimpleNamespace(embed=AsyncMock(return_value=[[1.0] + [0.0] * 1535]))
        result = await RagRetriever(repository, embeddings, CollectionSpec()).retrieve(
            QueryRequest(collection="cdc", question="어떤 놀이?", filters=filters)
        )
        assert result.reason == "no_relevant_chunks"
        assert repository.search.call_args.kwargs["filters"] == filters

    asyncio.run(scenario())


def test_knowledge_citation_preserves_pages_and_safety_context():
    from app.features.rag.models import CollectionState, QueryRequest, RetrievedChunk
    from app.features.rag.service import RagService

    async def scenario():
        doc = load_knowledge(DATA, "cdc")[0]
        repository = SimpleNamespace(
            collection=AsyncMock(
                return_value=CollectionState(CollectionSpec(chunking_mode="prechunked"), True)
            ),
            search=AsyncMock(
                return_value=[
                    RetrievedChunk(
                        document_id=doc.document_id,
                        ordinal=0,
                        revision="revision",
                        title=doc.title,
                        source=doc.source,
                        text=doc.text,
                        similarity=0.9,
                        metadata=doc.metadata,
                    )
                ]
            ),
        )
        generator = SimpleNamespace(
            model="fixture",
            complete=AsyncMock(
                return_value=json.dumps({"content": "참고하세요. [S1]", "references": ["S1"]})
            ),
        )
        embeddings = SimpleNamespace(embed=AsyncMock(return_value=[[1.0] + [0.0] * 1535]))
        result = await RagService(repository, embeddings, generator, CollectionSpec()).query(
            QueryRequest(collection="cdc", question="발달이 걱정돼요")
        )
        assert result.sources[0].metadata == doc.metadata
        assert result.sources[0].metadata.source_pages == [1, 2]
        call = generator.complete.call_args.kwargs
        assert "75%" in call["system_prompt"]
        assert "unofficial" in call["system_prompt"]

    asyncio.run(scenario())


def test_cli_validates_without_credentials_and_reports_resume_counts(monkeypatch, capsys, tmp_path):
    from app.features.rag import knowledge_cli

    for field in ["OPENROUTER_API_KEY", "RAG_INGEST_DATABASE_URL"]:
        monkeypatch.delenv(field, raising=False)
    assert knowledge_cli.main(["--collection", "cdc", "--file", str(DATA), "--validate-only"]) == 0
    assert json.loads(capsys.readouterr().out)["validated"] == 92
    invalid = tmp_path / "invalid.jsonl"
    invalid.write_text(DATA.read_text().splitlines()[0] + "\ninvalid")
    ingest = AsyncMock()
    monkeypatch.setattr(knowledge_cli, "ingest_records", ingest)
    assert knowledge_cli.main(["--collection", "cdc", "--file", str(invalid)]) == 2
    ingest.assert_not_called()
    assert "line 2" in capsys.readouterr().err


@pytest.mark.parametrize(
    "outcomes,exit_code,expected",
    [
        (
            ["updated", "unchanged"],
            0,
            {"status": "completed", "total": 2, "updated": 1, "unchanged": 1},
        ),
        (
            ["updated", "failure"],
            2,
            {"status": "partial", "completed": 1, "updated": 1, "unchanged": 0},
        ),
    ],
)
def test_cli_reports_completed_and_partial_runs(monkeypatch, capsys, outcomes, exit_code, expected):
    from app.features.rag import knowledge_cli
    from app.features.rag.errors import RagEmbeddingError

    docs = load_knowledge(DATA, "cdc")[:2]
    pool = SimpleNamespace(open=AsyncMock(), close=AsyncMock())
    monkeypatch.setattr(knowledge_cli, "create_pool", lambda *_: pool)
    monkeypatch.setattr(knowledge_cli, "OpenRouterEmbeddings", lambda *_: object())
    ingest = AsyncMock(
        side_effect=[
            RagEmbeddingError("secret must not appear") if value == "failure" else value
            for value in outcomes
        ]
    )
    monkeypatch.setattr(knowledge_cli, "Ingestor", lambda *_: SimpleNamespace(ingest=ingest))
    secret = SimpleNamespace(get_secret_value=lambda: "fixture-secret")
    config = SimpleNamespace(
        rag_embedding_model=None, rag_ingest_database_url=secret, openrouter_api_key=secret
    )
    assert asyncio.run(knowledge_cli.ingest_records(docs, config)) == exit_code
    captured = capsys.readouterr()
    result = json.loads(captured.out if exit_code == 0 else captured.err)
    assert all(result[key] == value for key, value in expected.items())
    if exit_code:
        assert result["failed_id"] == docs[1].document_id
        assert result["error"] == "RagEmbeddingError"
    assert "secret" not in captured.out + captured.err
    pool.close.assert_awaited_once_with(timeout=5)
