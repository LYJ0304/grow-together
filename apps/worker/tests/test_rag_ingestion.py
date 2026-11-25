import asyncio
import hashlib
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.features.rag.errors import RagCollectionError, RagConflictError, RagEmbeddingError
from app.features.rag.ingestion import Ingestor
from app.features.rag.models import CollectionSpec, CollectionState, Document, DocumentState


@pytest.fixture
def setup():
    spec = CollectionSpec()
    repository = SimpleNamespace(
        collection=AsyncMock(return_value=None),
        document=AsyncMock(return_value=None),
        replace=AsyncMock(return_value=True),
    )
    embeddings = SimpleNamespace(
        embed=AsyncMock(side_effect=lambda texts: [[1.0] + [0.0] * 1535 for _ in texts])
    )
    document = Document(
        collection="parenting",
        document_id="fixture",
        title="책 읽기",
        source="fixture://one",
        text="아이와 함께 책을 읽어요.",
    )
    return repository, embeddings, spec, document


def run(setup):
    repository, embeddings, spec, document = setup
    return asyncio.run(Ingestor(repository, embeddings, spec).ingest(document))


def test_stages_embeddings_and_replaces_once(setup):
    assert run(setup) == "updated"
    setup[0].replace.assert_awaited_once()
    arguments = setup[0].replace.call_args.kwargs
    assert arguments["expected_revision"] is None
    assert len(arguments["vectors"]) == len(arguments["chunks"]) == 1
    assert arguments["content_hash"] == hashlib.sha256(setup[3].text.encode()).hexdigest()


def test_identical_document_skips_paid_embedding_and_writes(setup):
    document = setup[3]
    setup[0].document.return_value = DocumentState(
        "revision",
        hashlib.sha256(document.text.encode()).hexdigest(),
        document.title,
        document.source,
    )
    assert run(setup) == "unchanged"
    setup[1].embed.assert_not_called()
    setup[0].replace.assert_not_called()


def test_embedding_failure_preserves_old_document(setup):
    setup[1].embed.side_effect = RagEmbeddingError("Embedding request failed")
    with pytest.raises(RagEmbeddingError):
        run(setup)
    setup[0].replace.assert_not_called()


def test_collection_mismatch_prevents_embedding(setup):
    setup[0].collection.return_value = CollectionState(
        CollectionSpec(embedding_model="other/model"), True
    )
    with pytest.raises(RagCollectionError):
        run(setup)
    setup[1].embed.assert_not_called()


def test_concurrent_update_is_not_silently_overwritten(setup):
    setup[0].replace.side_effect = RagConflictError("Document changed; retry ingestion")
    with pytest.raises(RagConflictError):
        run(setup)


def test_embedding_batches_are_bounded(setup):
    repository, embeddings, spec, document = setup
    run((repository, embeddings, spec, document.model_copy(update={"text": "가" * 30000})))
    assert len(embeddings.embed.call_args_list) > 1
    assert all(len(call.args[0]) <= 16 for call in embeddings.embed.call_args_list)
    repository.replace.assert_awaited_once()
