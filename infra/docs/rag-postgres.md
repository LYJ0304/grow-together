# RAG PostgreSQL / pgvector

This is the storage infrastructure for #239 and the Worker Vanilla RAG foundation
for #240. No production corpus is loaded. The initial embedding space is
openai/text-embedding-3-small, 1536 dimensions, cosine. See
[Worker RAG](../../apps/worker/docs/rag.md) for the execution contract and limitations.

## Boundaries

- The API keeps its existing `postgres` service, credentials, migrations and volume.
- `rag-postgres` uses PostgreSQL 16 + pgvector **0.8.2**, pinned as
  `pgvector/pgvector:0.8.2-pg16` in both Compose files. Upgrade this separately;
  do not change the PostgreSQL major version or reuse the service DB volume.
- API joins `default` + `ai`; Worker joins `ai` + `rag`; RAG DB/migrator join only
  the internal `rag` network. Worker cannot directly reach the service DB network.
  Worker still has outbound connectivity on `ai` for existing model calls.
- No RAG DB port is published. `rag-postgres-data` is a distinct persistent volume.
- The optional `rag` profile and blank `RAG_DATABASE_URL` leave existing Worker
  startup independent of RAG. The URL is secret; a reader pool is created only
  when RAG_ENABLED=true.

## Roles and schema ownership

| Role | Permission | Where used |
| --- | --- | --- |
| `rag_admin` | Bootstrap/extension administrator | DB and one-shot provisioning only |
| `rag_migrator` | Owns `rag` schema, application DDL and migration history | Migration job only |
| `rag_ingest` | SELECT/INSERT/UPDATE/DELETE, sequence use | Future ingestion CLI only |
| `rag_reader` | SELECT only | Future Worker query runtime |

Runtime roles cannot CREATE in the database, `public`, `rag`, or `extensions`,
create temporary tables, install extensions, SET ROLE to the owner or edit
migration history. `PUBLIC` CONNECT/TEMP permissions on the RAG DB and CONNECT on
maintenance databases are removed. Vector lives in administrator-owned
`extensions`; application objects live in `rag`. The migration owner defines default
privileges for its future tables/sequences. Future application migrations must run
as `rag_migrator`; grants for tables owned by another account are not automatic.

Bootstrap refuses inherited RAG roles or an unexpected `rag` schema owner. These
role names are reserved for this dedicated instance; do not repurpose existing
accounts. This is **not** a script for an arbitrary shared PostgreSQL instance:
it hardens `public`, `postgres`, and `template1` privileges in this RAG cluster.

## Local / staging setup

Run from the repository root. Use `infra/.env` locally; use `infra/staging/.env`
and `infra/compose.staging.yaml` for staging. Keep real values out of Git and logs.

Set four **different** random passwords in the chosen infra env file:
`RAG_POSTGRES_PASSWORD`, `RAG_MIGRATOR_PASSWORD`, `RAG_INGEST_PASSWORD`, and
`RAG_READER_PASSWORD`. They intentionally have no fallback passwords. Blank values
are accepted when RAG is disabled; starting the DB/job without them fails closed.

Set `RAG_DATABASE_URL` to the reader DSN:
`postgresql://rag_reader:<percent-encoded-password>@rag-postgres:5432/growtogether_rag`.
Percent-encode the password as a URL component; do not concatenate an unescaped
password. Do not put administrator/ingestion/migration credentials in this URL.
For Compose the infra env file supplies this setting; `apps/worker/.env` is the
setting location only when running Worker outside Compose. Outside access needs
an explicitly secured tunnel/network arrangement; no public port is added here.

```sh
docker compose --env-file infra/.env -f infra/compose.yaml --profile rag up -d rag-postgres
docker compose --env-file infra/.env -f infra/compose.yaml --profile rag run --rm rag-migrate
# Existing Worker remains usable. Enable RAG_ENABLED=true only after provisioning.
docker compose --env-file infra/.env -f infra/compose.yaml --profile worker up -d worker
```

For staging substitute `--env-file infra/staging/.env -f infra/compose.staging.yaml`
in all commands. The one-shot migrator mounts `infra/rag-postgres` and
`apps/worker/db` read-only, so deploy the source checkout as well as the app images.
Do not enable RAG traffic before provisioning and corpus evaluation succeed.

## Existing volume, migrations and recovery

The DB container initializes only an empty volume. **Always run `rag-migrate` after
starting a new or existing RAG volume.** It idempotently provisions roles/schema/
extension, then switches from bootstrap administrator to the migration owner.
Re-running applies current role passwords, so coordinate password rotation with
all consuming DSNs. It does not rewrite existing migration files or drop data.

`apps/worker/db/migrate.sh` needs only `psql`, `sha256sum`, and a POSIX shell. It
uses the normal libpq PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD settings; the
migration connection must be `rag_migrator` in `growtogether_rag`. To run after
administrator provisioning without retaining admin credentials:

```sh
# Supply PGPASSWORD securely in the environment, not in shell command arguments.
PGHOST=rag-postgres PGDATABASE=growtogether_rag PGUSER=rag_migrator \
  sh apps/worker/db/migrate.sh
```

Append files named `0002__description.sql`, etc. Keep applied files immutable.
A transaction-scoped advisory lock serializes runners; migration history stores
SHA-256 checksums. A changed applied file fails instead of silently rerunning.
Each batch is atomic: failures roll back new DDL/data/history. Runtime roles have
no access to the history table. Do not add nontransactional statements such as
`CREATE INDEX CONCURRENTLY` to this runner.

Before upgrades/backfills, take and validate a backup using the environment's
normal secure backup process. On failure, inspect sanitized errors, repair the
prerequisite, and rerun. Restore an accidentally edited migration from its original
version; add a forward migration for actual schema changes. Never use `down -v`,
drop the existing service/RAG volume, edit history/checksums or automatically
DROP EXTENSION as a recovery shortcut. PostgreSQL major upgrades require a
separate tested migration/restore plan.

### Managed PostgreSQL / restricted extension privileges

The default deployment is a dedicated container, not a change to an existing
production DB. Before using a managed database, its administrator must confirm
PostgreSQL/pgvector support and installation rights. Have the DBA provision the
reserved roles and permissions from `bootstrap.sql`, install vector in
`extensions`, and grant the migration owner its schema. Then run only the owner
migration step. Do not elevate runtime accounts or make the API's Flyway install
Worker-owned tables. If vector already exists in another schema, stop and plan the
DBA change with dependencies/backups; bootstrap intentionally fails instead of
moving it implicitly.

## Verification

```sh
python3 infra/tests/test_rag_compose.py
python3 infra/tests/test_rag_postgres.py
cd apps/worker
uv sync --locked
uv run ruff check .
uv run pytest
```

Compose tests render local/staging settings with test-only variables and clear
app env_file references via a temporary override; they never load real app secrets.
The PostgreSQL test starts a unique disposable pgvector container and removes it
at completion. It verifies extension/real vector distance, existing data/roles,
reapply, default grants on new tables/sequences, denied maintenance DB access,
DDL/write/history rejection, checksum drift, rollback and concurrent runners.
`RAG_TEST_CONTAINER` is an opt-in for a **disposable** `rag-239-test*` fixture only:
the test resets its RAG database/roles. Never point it at a retained environment.
Container startup failures are failures, not skipped/passing integration tests.

Inspect a provisioned RAG DB without disclosing secrets:

```sql
SELECT version();
SELECT extversion FROM pg_extension WHERE extname = 'vector';
SELECT '[1,2,3]'::extensions.vector OPERATOR(extensions.<->) '[1,2,4]'::extensions.vector;
SELECT version, applied_at FROM rag.schema_migrations ORDER BY version;
```

Run history inspection as administrator/migration owner, not the reader. Actual
production DB support, backups and deployment remain separately unverified until
performed in that environment. [pgvector v0.8.2](https://github.com/pgvector/pgvector/tree/v0.8.2)
provides the extension and PostgreSQL image reference.
