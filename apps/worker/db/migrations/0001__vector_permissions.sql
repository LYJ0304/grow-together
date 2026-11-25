-- vector installation is administrator-owned, outside the runtime/migration role.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
                   WHERE e.extname='vector' AND n.nspname='extensions') THEN
        RAISE EXCEPTION 'RAG vector extension is not provisioned';
    END IF;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA rag FROM PUBLIC, rag_reader, rag_ingest;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA rag FROM PUBLIC, rag_reader, rag_ingest;
GRANT SELECT ON ALL TABLES IN SCHEMA rag TO rag_reader;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA rag TO rag_ingest;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA rag TO rag_ingest;
ALTER DEFAULT PRIVILEGES IN SCHEMA rag GRANT SELECT ON TABLES TO rag_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA rag GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rag_ingest;
ALTER DEFAULT PRIVILEGES IN SCHEMA rag GRANT USAGE, SELECT ON SEQUENCES TO rag_ingest;
