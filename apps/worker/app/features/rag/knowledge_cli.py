"""Operator-only pre-chunked JSONL ingestion; validates all rows before any writes."""

import argparse
import asyncio
import json
import sys
from collections import Counter
from pathlib import Path

from pydantic import ValidationError

from .cli import IngestSettings
from .embeddings import OpenRouterEmbeddings
from .errors import RagError
from .ingestion import Ingestor
from .knowledge import load_knowledge
from .models import DEFAULT_EMBEDDING_MODEL, CollectionSpec
from .storage import RagRepository, create_pool


async def ingest_records(documents, config):
    spec = CollectionSpec(
        embedding_model=config.rag_embedding_model or DEFAULT_EMBEDDING_MODEL,
        chunking_mode="prechunked",
    )
    pool = create_pool(config.rag_ingest_database_url.get_secret_value(), "rag_ingest")
    counts = Counter(updated=0, unchanged=0)
    try:
        await pool.open()
        ingestor = Ingestor(
            RagRepository(pool),
            OpenRouterEmbeddings(
                config.openrouter_api_key.get_secret_value(), spec.embedding_model
            ),
            spec,
        )
        for document in documents:
            try:
                counts[await ingestor.ingest(document)] += 1
            except RagError as error:
                # Earlier records are committed; a rerun skips them. Never claim file atomicity.
                print(
                    json.dumps(
                        {
                            "status": "partial",
                            "completed": sum(counts.values()),
                            **counts,
                            "failed_id": document.document_id,
                            "error": type(error).__name__,
                        }
                    ),
                    file=sys.stderr,
                )
                return 2
        print(json.dumps({"status": "completed", "total": len(documents), **counts}))
        return 0
    finally:
        await pool.close(timeout=5)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Ingest pre-chunked knowledge JSONL")
    parser.add_argument("--collection", required=True)
    parser.add_argument("--file", required=True)
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args(argv)
    try:
        documents = load_knowledge(Path(args.file), args.collection)
        if args.validate_only:
            print(json.dumps({"validated": len(documents), "collection": args.collection}))
            return 0
        return asyncio.run(ingest_records(documents, IngestSettings()))
    except RagError as error:
        print(json.dumps({"error": type(error).__name__}), file=sys.stderr)
    except (ValidationError, OSError, UnicodeError):
        print(json.dumps({"error": "InvalidKnowledgeInputOrConfiguration"}), file=sys.stderr)
    except ValueError as error:
        # Only our loader's line number is safe to print; never Pydantic/config values.
        message = str(error)
        safe = (
            message
            if message.startswith("Invalid knowledge record at line ")
            else "InvalidKnowledgeInput"
        )
        print(json.dumps({"error": safe}), file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
