"""Operator-only normalized text ingestion. No HTTP ingestion endpoint."""

import argparse
import asyncio
import json
import sys
from pathlib import Path

from pydantic import SecretStr, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

from .chunking import MAX_DOCUMENT_BYTES
from .embeddings import OpenRouterEmbeddings
from .errors import RagError
from .ingestion import Ingestor
from .models import DEFAULT_EMBEDDING_MODEL, CollectionSpec, Document
from .storage import RagRepository, create_pool


class IngestSettings(BaseSettings):
    """CLI credentials deliberately exclude reader/admin/generation settings."""

    openrouter_api_key: SecretStr
    rag_ingest_database_url: SecretStr
    rag_embedding_model: str | None = None
    model_config = SettingsConfigDict(extra="ignore")


async def ingest(document, config):
    spec = CollectionSpec(embedding_model=config.rag_embedding_model or DEFAULT_EMBEDDING_MODEL)
    pool = create_pool(config.rag_ingest_database_url.get_secret_value(), "rag_ingest")
    try:
        await pool.open()
        return await Ingestor(
            RagRepository(pool),
            OpenRouterEmbeddings(
                config.openrouter_api_key.get_secret_value(), spec.embedding_model
            ),
            spec,
        ).ingest(document)
    finally:
        await pool.close(timeout=5)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Ingest bounded UTF-8 text into a RAG collection")
    for name in ["collection", "document-id", "title", "source", "file"]:
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args(argv)
    try:
        config = IngestSettings()
        with Path(args.file).open("rb") as source:
            content = source.read(MAX_DOCUMENT_BYTES + 1)
        if len(content) > MAX_DOCUMENT_BYTES:
            raise ValueError("Document is too large")
        document = Document(
            collection=args.collection,
            document_id=args.document_id,
            title=args.title,
            source=args.source,
            text=content.decode("utf-8"),
        )
        status = asyncio.run(ingest(document, config))
        print(
            json.dumps(
                {
                    "status": status,
                    "collection": document.collection,
                    "document_id": document.document_id,
                }
            )
        )
        return 0
    except RagError as error:
        print(json.dumps({"error": type(error).__name__}), file=sys.stderr)
        return 2
    except (ValidationError, ValueError, OSError, UnicodeError):
        print(json.dumps({"error": "InvalidIngestionInputOrConfiguration"}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
