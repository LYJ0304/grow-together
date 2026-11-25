#!/bin/sh
# Run only against the dedicated RAG instance; never the API database.
set -eu
: "${PGHOST:?Set PGHOST}"
: "${PGDATABASE:?Set PGDATABASE}"
: "${PGUSER:?Set the bootstrap administrator PGUSER}"
: "${PGPASSWORD:?Set the bootstrap administrator PGPASSWORD}"
: "${RAG_READER_PASSWORD:?Set RAG_READER_PASSWORD}"
: "${RAG_INGEST_PASSWORD:?Set RAG_INGEST_PASSWORD}"
: "${RAG_MIGRATOR_PASSWORD:?Set RAG_MIGRATOR_PASSWORD}"
[ "$PGDATABASE" = growtogether_rag ] || { echo 'Refusing a non-RAG database' >&2; exit 1; }
for password in "$RAG_READER_PASSWORD" "$RAG_INGEST_PASSWORD" "$RAG_MIGRATOR_PASSWORD"; do
    [ "$password" != "$PGPASSWORD" ] || { echo 'Use distinct role passwords' >&2; exit 1; }
done
[ "$RAG_READER_PASSWORD" != "$RAG_INGEST_PASSWORD" ] &&
[ "$RAG_READER_PASSWORD" != "$RAG_MIGRATOR_PASSWORD" ] &&
[ "$RAG_INGEST_PASSWORD" != "$RAG_MIGRATOR_PASSWORD" ] || {
    echo 'Use distinct role passwords' >&2; exit 1;
}
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
psql -X -v ON_ERROR_STOP=1 -f "$script_dir/bootstrap.sql"
# The owner is separate from both bootstrap and runtime identities.
PGUSER=rag_migrator PGPASSWORD="$RAG_MIGRATOR_PASSWORD" \
    sh "${RAG_MIGRATION_SCRIPT:-/worker-db/migrate.sh}"
