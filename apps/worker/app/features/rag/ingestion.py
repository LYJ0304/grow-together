import asyncio
import hashlib
import logging
import time

from .chunking import normalize_text, split_text
from .errors import RagCollectionError, RagTimeoutError

LOGGER = logging.getLogger(__name__)


class Ingestor:
    def __init__(self, repository, embeddings, spec):
        self.repository = repository
        self.embeddings = embeddings
        self.spec = spec

    async def ingest(self, document):
        started = time.monotonic()
        status = "failed"
        try:
            async with asyncio.timeout(300):
                status = await self._ingest(document)
                return status
        except TimeoutError:
            status = "timeout"
            raise RagTimeoutError("RAG ingestion timed out") from None
        finally:
            LOGGER.info(
                "rag_ingest status=%s duration_ms=%d",
                status,
                int((time.monotonic() - started) * 1000),
            )

    async def _ingest(self, document):
        text = (
            document.text
            if self.spec.chunking_mode == "prechunked"
            else normalize_text(document.text)
        )
        if self.spec.chunking_mode == "prechunked" and len(text) > 2000:
            raise ValueError("Pre-chunked content exceeds storage limit")
        content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
        state = await self.repository.collection(document.collection)
        if state is not None and state.spec != self.spec:
            raise RagCollectionError("Collection embedding/chunk configuration mismatch")
        previous = await self.repository.document(document.collection, document.document_id)
        if previous and previous.content_hash == content_hash:
            if (previous.title, previous.source, previous.metadata) == (
                document.title,
                document.source,
                document.metadata,
            ):
                return "unchanged"
            changed = await self.repository.update_metadata(document, previous.revision)
            return "updated" if changed else "unchanged"
        chunks = (
            [text]
            if self.spec.chunking_mode == "prechunked"
            else split_text(text, self.spec.chunk_size, self.spec.chunk_overlap)
        )
        vectors = []
        for start in range(0, len(chunks), 16):
            vectors.extend(await self.embeddings.embed(chunks[start : start + 16]))
        changed = await self.repository.replace(
            document=document,
            spec=self.spec,
            content_hash=content_hash,
            expected_revision=previous.revision if previous else None,
            chunks=chunks,
            vectors=vectors,
        )
        return "updated" if changed else "unchanged"
