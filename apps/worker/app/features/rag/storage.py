from urllib.parse import parse_qsl, unquote, urlsplit
from uuid import uuid4

from pgvector import Vector
from pgvector.psycopg import register_vector_async
from psycopg import Error
from psycopg.conninfo import conninfo_to_dict
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool, PoolClosed, PoolTimeout
from pydantic import ValidationError

from .embeddings import validate_vector
from .errors import RagCollectionError, RagConfigurationError, RagConflictError, RagStorageError
from .knowledge import KnowledgeMetadata, metadata_json
from .models import CollectionSpec, CollectionState, DocumentState, RetrievedChunk

DB_ERRORS = (Error, PoolTimeout, PoolClosed)


def validate_database_url(url: str, role: str) -> str:
    try:
        url.encode("utf-8")
        parsed = conninfo_to_dict(url)
        if parsed.get("user") != role or parsed.get("dbname") != "growtogether_rag":
            raise ValueError
        parts = urlsplit(url)
        if (
            parts.scheme not in {"postgres", "postgresql"}
            or not parts.hostname
            or unquote(parts.username or "") != role
            or not parts.password
            or unquote(parts.path) != "/growtogether_rag"
            or parts.fragment
            or any(key not in {"sslmode", "sslrootcert"} for key, _ in parse_qsl(parts.query))
        ):
            raise ValueError
        if parts.port is not None and not 1 <= parts.port <= 65535:
            raise ValueError
    except (ValueError, TypeError, Error):
        raise RagConfigurationError("RAG requires a dedicated role and database URL") from None
    return url


def create_pool(url: str, role: str) -> AsyncConnectionPool:
    validate_database_url(url, role)

    async def configure(connection):
        cursor = await connection.execute("SELECT current_user AS role, current_database() AS db")
        identity = await cursor.fetchone()
        if identity["role"] != role or identity["db"] != "growtogether_rag":
            raise RagConfigurationError("Unexpected RAG database identity")
        await register_vector_async(connection)

    options = "-c statement_timeout=3000 -c lock_timeout=2000 -c idle_in_transaction_session_timeout=10000"
    if role == "rag_reader":
        options += " -c default_transaction_read_only=on"
    return AsyncConnectionPool(
        url,
        min_size=0,
        max_size=4 if role == "rag_reader" else 1,
        max_waiting=8,
        timeout=3,
        reconnect_timeout=3,
        open=False,
        name="rag",
        kwargs={
            "autocommit": True,
            "row_factory": dict_row,
            "connect_timeout": 3,
            "options": options,
        },
        configure=configure,
    )


class RagRepository:
    def __init__(self, pool):
        self.pool = pool

    async def collection(self, name):
        try:
            async with self.pool.connection() as connection:
                cursor = await connection.execute(
                    """SELECT embedding_model, dimensions,
                    distance_metric, chunk_size, chunk_overlap, chunking_mode,
                    EXISTS(SELECT 1 FROM rag.chunks WHERE collection_name = c.name) AS has_chunks
                    FROM rag.collections c WHERE name = %s""",
                    (name,),
                )
                row = await cursor.fetchone()
                if row is None:
                    return None
                has_chunks = row.pop("has_chunks")
                return CollectionState(CollectionSpec(**row), has_chunks)
        except (*DB_ERRORS, ValidationError):
            raise RagStorageError("RAG storage unavailable") from None

    async def document(self, collection, document_id):
        try:
            async with self.pool.connection() as connection:
                cursor = await connection.execute(
                    """SELECT revision, content_hash, title, source, metadata
                    FROM rag.documents WHERE collection_name=%s AND document_id=%s""",
                    (collection, document_id),
                )
                row = await cursor.fetchone()
                return (
                    DocumentState(
                        str(row["revision"]),
                        row["content_hash"],
                        row["title"],
                        row["source"],
                        KnowledgeMetadata.model_validate(row["metadata"])
                        if row["metadata"]
                        else None,
                    )
                    if row
                    else None
                )
        except (*DB_ERRORS, ValidationError):
            raise RagStorageError("RAG storage unavailable") from None

    async def search(self, collection, vector, top_k, *, filters=None):
        if not 1 <= top_k <= 10:
            raise ValueError("Invalid result limit")
        vector = Vector(validate_vector(vector))
        conditions, parameters = ["c.collection_name=%s"], [collection]
        if filters is not None:
            if filters.age_months is not None:
                conditions.append("""d.metadata IS NOT NULL AND (
                    d.age_months = (SELECT max(b.age_months) FROM rag.documents b
                        WHERE b.collection_name=d.collection_name AND b.source_id=d.source_id
                        AND b.age_months <= %s)
                    OR (d.age_months IS NULL AND (
                        d.metadata->'applicable_age_months' IS NULL
                        OR d.metadata->'applicable_age_months' = 'null'::jsonb
                        OR %s BETWEEN (d.metadata->'applicable_age_months'->>0)::integer
                            AND (d.metadata->'applicable_age_months'->>-1)::integer)))""")
                parameters.extend([filters.age_months, filters.age_months])
            for field in ("chunk_type", "topic"):
                value = getattr(filters, field)
                if value is not None:
                    conditions.append(f"d.{field}=%s")
                    parameters.append(value)
        where = " AND ".join(conditions)
        try:
            async with self.pool.connection() as connection:
                cursor = await connection.execute(
                    f"""SELECT d.document_id, c.ordinal, d.revision::text AS revision,
                    d.title, d.source, d.metadata, c.body AS text,
                    1 - (c.embedding OPERATOR(extensions.<=>) %s) AS similarity
                    FROM rag.chunks c JOIN rag.documents d USING (collection_name, document_id)
                    WHERE {where}
                    ORDER BY similarity DESC, d.document_id, c.ordinal LIMIT %s""",
                    (vector, *parameters, top_k),
                )
                rows = await cursor.fetchall()
                return [
                    RetrievedChunk(**{**row, "similarity": max(-1.0, min(1.0, row["similarity"]))})
                    for row in rows
                ]
        except (*DB_ERRORS, ValidationError):
            raise RagStorageError("RAG storage unavailable") from None

    async def replace(self, *, document, spec, content_hash, expected_revision, chunks, vectors):
        if not 1 <= len(chunks) <= 160 or len(chunks) != len(vectors):
            raise ValueError("Invalid document chunks")
        vectors = [Vector(validate_vector(vector)) for vector in vectors]
        try:
            async with self.pool.connection() as connection, connection.transaction():
                # Embeddings are already staged. Serialize only this document's replacement.
                await connection.execute(
                    "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
                    (document.collection + "\x1f" + document.document_id,),
                )
                await connection.execute(
                    """INSERT INTO rag.collections
                    (name, embedding_model, dimensions, distance_metric, chunk_size, chunk_overlap, chunking_mode)
                    VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (name) DO NOTHING""",
                    (
                        document.collection,
                        spec.embedding_model,
                        spec.dimensions,
                        spec.distance_metric,
                        spec.chunk_size,
                        spec.chunk_overlap,
                        spec.chunking_mode,
                    ),
                )
                cursor = await connection.execute(
                    """SELECT embedding_model, dimensions,
                    distance_metric, chunk_size, chunk_overlap, chunking_mode FROM rag.collections WHERE name=%s""",
                    (document.collection,),
                )
                if CollectionSpec(**await cursor.fetchone()) != spec:
                    raise RagCollectionError("Collection embedding/chunk configuration mismatch")
                cursor = await connection.execute(
                    """SELECT revision, content_hash, title, source, metadata
                    FROM rag.documents WHERE collection_name=%s AND document_id=%s""",
                    (document.collection, document.document_id),
                )
                current = await cursor.fetchone()
                if current and (
                    current["content_hash"],
                    current["title"],
                    current["source"],
                    current["metadata"],
                ) == (
                    content_hash,
                    document.title,
                    document.source,
                    metadata_json(document.metadata),
                ):
                    return False
                if (str(current["revision"]) if current else None) != expected_revision:
                    raise RagConflictError("Document changed; retry ingestion")
                await connection.execute(
                    "DELETE FROM rag.chunks WHERE collection_name=%s AND document_id=%s",
                    (document.collection, document.document_id),
                )
                await connection.execute(
                    """INSERT INTO rag.documents
                    (collection_name, document_id, title, source, content_hash, revision, metadata)
                    VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (collection_name, document_id)
                    DO UPDATE SET title=EXCLUDED.title, source=EXCLUDED.source,
                    content_hash=EXCLUDED.content_hash, revision=EXCLUDED.revision,
                    metadata=EXCLUDED.metadata,
                    updated_at=CURRENT_TIMESTAMP""",
                    (
                        document.collection,
                        document.document_id,
                        document.title,
                        document.source,
                        content_hash,
                        uuid4(),
                        Jsonb(metadata_json(document.metadata)) if document.metadata else None,
                    ),
                )
                async with connection.cursor() as cursor:
                    await cursor.executemany(
                        """INSERT INTO rag.chunks
                        (collection_name, document_id, ordinal, body, embedding)
                        VALUES (%s,%s,%s,%s,%s)""",
                        [
                            (document.collection, document.document_id, index, text, vector)
                            for index, (text, vector) in enumerate(
                                zip(chunks, vectors, strict=True)
                            )
                        ],
                    )
                return True
        except (*DB_ERRORS, ValidationError):
            raise RagStorageError("RAG storage unavailable") from None

    async def update_metadata(self, document, expected_revision):
        """Metadata-only edits retain the existing body/vector; CAS protects concurrent writes."""
        try:
            async with self.pool.connection() as connection:
                cursor = await connection.execute(
                    """UPDATE rag.documents SET title=%s, source=%s, metadata=%s,
                    revision=%s, updated_at=CURRENT_TIMESTAMP
                    WHERE collection_name=%s AND document_id=%s AND revision=%s
                    RETURNING document_id""",
                    (
                        document.title,
                        document.source,
                        Jsonb(metadata_json(document.metadata)) if document.metadata else None,
                        uuid4(),
                        document.collection,
                        document.document_id,
                        expected_revision,
                    ),
                )
                if await cursor.fetchone() is None:
                    raise RagConflictError("Document changed; retry ingestion")
                return True
        except DB_ERRORS:
            raise RagStorageError("RAG storage unavailable") from None
