-- Initial embedding space: OpenRouter openai/text-embedding-3-small, 1536, cosine.
-- A different model requires a new collection; different dimensions require a migration.
CREATE TABLE rag.collections (
    name varchar(80) PRIMARY KEY,
    embedding_model varchar(200) NOT NULL,
    dimensions integer NOT NULL CHECK (dimensions = 1536),
    distance_metric text NOT NULL CHECK (distance_metric = 'cosine'),
    chunk_size integer NOT NULL CHECK (chunk_size BETWEEN 1 AND 2000),
    chunk_overlap integer NOT NULL CHECK (chunk_overlap >= 0 AND chunk_overlap < chunk_size)
);
CREATE TABLE rag.documents (
    collection_name varchar(80) NOT NULL REFERENCES rag.collections(name),
    document_id varchar(80) NOT NULL,
    title varchar(200) NOT NULL,
    source varchar(1000) NOT NULL,
    content_hash char(64) NOT NULL,
    revision uuid NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection_name, document_id)
);
CREATE TABLE rag.chunks (
    collection_name varchar(80) NOT NULL,
    document_id varchar(80) NOT NULL,
    ordinal integer NOT NULL CHECK (ordinal >= 0 AND ordinal < 160),
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    embedding extensions.vector(1536) NOT NULL CHECK (extensions.vector_norm(embedding) > 0),
    PRIMARY KEY (collection_name, document_id, ordinal),
    FOREIGN KEY (collection_name, document_id)
        REFERENCES rag.documents(collection_name, document_id) ON DELETE CASCADE
);
