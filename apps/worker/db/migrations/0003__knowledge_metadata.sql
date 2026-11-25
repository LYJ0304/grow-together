-- Keep existing text collections and immutable historical migrations intact.
ALTER TABLE rag.collections ADD COLUMN chunking_mode text NOT NULL DEFAULT 'text'
    CHECK (chunking_mode IN ('text', 'prechunked'));
ALTER TABLE rag.documents ADD COLUMN metadata jsonb
    CHECK (metadata IS NULL OR jsonb_typeof(metadata) = 'object');
ALTER TABLE rag.documents ADD COLUMN source_id text
    GENERATED ALWAYS AS (metadata->>'source_id') STORED;
ALTER TABLE rag.documents ADD COLUMN age_months integer
    GENERATED ALWAYS AS ((metadata->>'age_months')::integer) STORED
    CHECK (age_months BETWEEN 0 AND 240);
ALTER TABLE rag.documents ADD COLUMN chunk_type text
    GENERATED ALWAYS AS (metadata->>'chunk_type') STORED;
ALTER TABLE rag.documents ADD COLUMN topic text
    GENERATED ALWAYS AS (metadata->>'topic') STORED;
CREATE INDEX documents_source_age ON rag.documents (collection_name, source_id, age_months);
CREATE INDEX documents_type_topic ON rag.documents (collection_name, chunk_type, topic);
