#!/bin/sh
# psql/sha256sum only. One transaction and lock cover the complete migration batch.
set -eu
export LC_ALL=C
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
migrations=${RAG_MIGRATION_DIR:-$script_dir/migrations}
batch=$(mktemp)
trap 'rm -f "$batch"' EXIT HUP INT TERM
cat > "$batch" <<'SQL'
\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('growtogether-rag-migrations', 0));
DO $$ BEGIN
    IF current_user <> 'rag_migrator' OR current_database() <> 'growtogether_rag' THEN
        RAISE EXCEPTION 'Use the RAG migration owner and database';
    END IF;
END $$;
CREATE TABLE IF NOT EXISTS rag.schema_migrations (
    version text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
SQL
found=false
for file in "$migrations"/*.sql; do
    [ -f "$file" ] || continue
    found=true
    version=$(basename "$file")
    printf '%s' "$version" | grep -Eq '^[0-9]{4}__[a-z0-9_]+\.sql$' || {
        echo 'Invalid migration filename' >&2; exit 1;
    }
    checksum=$(sha256sum "$file" | cut -d ' ' -f 1)
    cat >> "$batch" <<SQL
DO \$\$ BEGIN
 IF EXISTS (SELECT 1 FROM rag.schema_migrations
            WHERE version='$version' AND checksum <> '$checksum') THEN
   RAISE EXCEPTION 'Migration checksum mismatch: $version';
 END IF;
END \$\$;
SELECT EXISTS (SELECT 1 FROM rag.schema_migrations WHERE version='$version') AS applied \gset
\if :applied
\echo 'Already applied: $version'
\else
SQL
    cat "$file" >> "$batch"
    cat >> "$batch" <<SQL

INSERT INTO rag.schema_migrations(version, checksum) VALUES ('$version', '$checksum');
\endif
SQL
done
[ "$found" = true ] || { echo 'No RAG migrations found' >&2; exit 1; }
cat >> "$batch" <<'SQL'
-- Default application grants must never grant writes to migration metadata.
REVOKE ALL ON rag.schema_migrations FROM PUBLIC, rag_reader, rag_ingest;
COMMIT;
SQL
psql -X -v ON_ERROR_STOP=1 -f "$batch"
