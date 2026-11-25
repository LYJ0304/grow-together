\set ON_ERROR_STOP on
\getenv reader_password RAG_READER_PASSWORD
\getenv ingest_password RAG_INGEST_PASSWORD
\getenv migrator_password RAG_MIGRATOR_PASSWORD
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('growtogether-rag-bootstrap', 0));
SELECT 'CREATE ROLE ' || quote_ident(role_name) FROM
    (VALUES ('rag_reader'), ('rag_ingest'), ('rag_migrator')) AS roles(role_name)
    WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) \gexec
SELECT format('ALTER ROLE rag_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', :'reader_password') \gexec
SELECT format('ALTER ROLE rag_ingest LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', :'ingest_password') \gexec
SELECT format('ALTER ROLE rag_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', :'migrator_password') \gexec
-- Fail closed on unexpected memberships; do not silently alter pre-existing users.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member
               WHERE r.rolname IN ('rag_reader', 'rag_ingest', 'rag_migrator')) THEN
        RAISE EXCEPTION 'RAG roles must not inherit other roles';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_shdepend d JOIN pg_roles r ON r.oid=d.refobjid
               WHERE d.refclassid='pg_authid'::regclass AND d.deptype='o' AND r.rolname IN ('rag_reader', 'rag_ingest')) THEN
        RAISE EXCEPTION 'Runtime RAG roles must not own database objects';
    END IF;
END $$;
REVOKE ALL ON DATABASE growtogether_rag FROM PUBLIC;
REVOKE ALL ON DATABASE postgres FROM PUBLIC, rag_reader, rag_ingest, rag_migrator;
REVOKE ALL ON DATABASE template1 FROM PUBLIC, rag_reader, rag_ingest, rag_migrator;
REVOKE ALL ON DATABASE growtogether_rag FROM rag_reader, rag_ingest, rag_migrator;
GRANT CONNECT ON DATABASE growtogether_rag TO rag_reader, rag_ingest, rag_migrator;
REVOKE ALL ON SCHEMA public FROM PUBLIC, rag_reader, rag_ingest, rag_migrator;
CREATE SCHEMA IF NOT EXISTS extensions;
REVOKE ALL ON SCHEMA extensions FROM PUBLIC, rag_reader, rag_ingest, rag_migrator;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
                   WHERE e.extname='vector' AND n.nspname='extensions') THEN
        RAISE EXCEPTION 'Install vector in the extensions schema before continuing';
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner
               WHERE n.nspname='extensions' AND r.rolname='rag_migrator') OR
       EXISTS (SELECT 1 FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba
               WHERE d.datname=current_database() AND r.rolname='rag_migrator') THEN
        RAISE EXCEPTION 'The migration role must not own the database or extensions schema';
    END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS rag AUTHORIZATION rag_migrator;
DO $$ BEGIN
    IF (SELECT nspowner FROM pg_namespace WHERE nspname='rag') <>
       (SELECT oid FROM pg_roles WHERE rolname='rag_migrator') THEN
        RAISE EXCEPTION 'Unexpected owner for rag schema';
    END IF;
END $$;
REVOKE ALL ON SCHEMA rag FROM PUBLIC, rag_reader, rag_ingest;
GRANT USAGE ON SCHEMA rag, extensions TO rag_reader, rag_ingest, rag_migrator;
ALTER ROLE rag_reader IN DATABASE growtogether_rag SET search_path = rag, extensions, pg_catalog;
ALTER ROLE rag_ingest IN DATABASE growtogether_rag SET search_path = rag, extensions, pg_catalog;
ALTER ROLE rag_migrator IN DATABASE growtogether_rag SET search_path = rag, extensions, pg_catalog;
COMMIT;
