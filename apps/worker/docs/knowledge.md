# Pre-chunked knowledge ingestion and retrieval

This extends the [existing RAG](rag.md); it does not add a second vector store or
connect knowledge automatically to any product feature. Spring API, service DB,
Mobile, Worker authentication, and `RAG_ENABLED=false` behavior remain unchanged.
No new dependency is needed. The Worker image includes `knowledge/` so an operator
can run the same CLI with an explicit command; server startup never auto-ingests it.

## Validate and ingest

From `apps/worker`:

```sh
uv sync --locked
uv run python -m app.features.rag.knowledge_cli \
  --collection cdc-ko-v1 --file knowledge/cdc/cdc_milestones_ko.jsonl --validate-only
```

Validation needs no credentials and makes no database/embedding calls. The entire
UTF-8 JSONL (up to 5 MB / 2000 records) is checked before ingestion starts, including
duplicate IDs, required metadata, ordered positive pages, ages, URLs, content limits,
and known chunk types. Unknown metadata keys are rejected rather than silently lost.
The source PDF modification date is optional but preserved when supplied.

Apply Worker-owned migrations through the existing `db/migrate.sh` procedure using
`rag_migrator` (see [RAG database operations](../../../infra/docs/rag-postgres.md)).
Migration `0003__knowledge_metadata.sql` leaves historical migrations unchanged,
adds collection chunking mode and document metadata, and indexes source/age and
chunk type/topic. Generated columns expose frequently filtered metadata fields.
Existing collections default to text mode and keep their data.

For actual ingestion, supply `OPENROUTER_API_KEY` and the dedicated
`RAG_INGEST_DATABASE_URL` via your environment, then run without `--validate-only`:

```sh
uv run python -m app.features.rag.knowledge_cli \
  --collection cdc-ko-v1 --file knowledge/cdc/cdc_milestones_ko.jsonl
```

This is an explicit paid embedding operation. No generation model or reader/admin
credentials are required. Each source ID becomes a document ID, with exactly one
ordinal-0 chunk. Only the exact `content` is embedded: no title/age prefix, text
normalization, or additional splitting. Existing embedding validation and timeouts
apply. The collection pins model/dimensions/cosine and pre-chunked mode. Reusing a
text-mode collection is rejected. A model change requires a new collection.

SHA-256 of content plus collection model configuration avoids repeated embeddings.
Metadata-only edits update citation data without re-embedding. Document replacement
is atomic and revision-checked; embedding/database failures retain its old content.
The whole file is **not** one transaction: prior successful records remain committed
on failure. CLI reports completed/updated/unchanged counts and failed ID, exits 2,
and can safely be rerun. It never deletes records absent from a subsequent file;
use a new collection for a curated snapshot that removes documents.

## Retrieval

The authenticated internal `POST /internal/v1/rag/query` accepts optional filters:

```json
{
  "collection": "cdc-ko-v1",
  "question": "아이와 어떤 상호작용을 해볼까요?",
  "top_k": 4,
  "filters": {"age_months": 5, "chunk_type": "parenting_guidance", "topic": "interaction"}
}
```

- Filters are applied in PostgreSQL **before** cosine ranking/Top-K (1–10).
- For each source, age-specific rows use the greatest stored benchmark age <= the
  child's requested age. For 5 months CDC uses 4, never 6. The benchmark is chosen
  independently of type/topic, so a missing type at 4 months does not pull in a
  future or arbitrarily older checklist. Original metadata ages are never rewritten.
- `age_months=null` common guidance remains eligible. If `applicable_age_months`
  exists, its sorted first/last values define the inclusive applicability interval
  evaluated against the **requested** age (e.g. 2–30 and 36–60); it is not coerced to
  a nearby milestone age. With no range, common guidance has no age restriction.
- At an age with no previous benchmark, no age-specific milestones are returned.
  No age filter means all ages are searchable; callers must pass age when asking
  for age-specific advice. An age is a source checklist benchmark, not a medical
  determination. Text documents without knowledge metadata do not bypass an age filter.
- Type/topic use exact matching and bound parameters. Empty or low-similarity
  results return `no_context` without generation. Existing minimum similarity is
  only an initial heuristic, not a validated clinical/retrieval quality threshold.

`RagRetriever.retrieve(QueryRequest(...))` is a generation-free interface returning
ranked relevant hits and an explicit no-context reason. Future features/evaluation
can use this without invoking an answer generator. `RagService` uses the same
retriever, bounds context size, and retains its existing generation responsibility.
Read compatibility checks embedding space, not ingestion chunk size/mode.

Citations preserve original ID, URL, PDF filename/pages/hash, benchmark age, topic,
language/locale, translation/review state, revision and similarity under `metadata`.
Old plain-text citations have `metadata=null`. FastAPI OpenAPI describes the new
internal fields. There are no external Spring API changes, so
`contracts/openapi.yaml` is unchanged.

The answer-generation prompt adds checklist interpretation, professional consultation,
US-specific guidance, and unofficial translation instructions for knowledge sources.
Prompt instructions do not guarantee medical safety or factual accuracy. Retrieval
consumers generating their own responses must retain source qualifications and apply
these safety requirements themselves.

## Verification

```sh
uv run pytest tests/test_knowledge.py tests/test_rag_service.py tests/test_rag_routes.py
uv run ruff check .
uv run pytest
# Disposable pgvector fixture, initialized via infra/tests/test_rag_postgres.py:
RAG_TEST_CONTAINER=rag-239-test-cdc uv run pytest tests/test_rag_postgres.py
```

Default tests use mock embeddings and make no paid requests. Real pgvector tests
cover all 92 records twice, no duplicate vectors, age fallback/common guidance,
type/topic filters, source pages, metadata-only vector reuse and stale revision
rejection. They verify storage/filter mechanics, not semantic retrieval quality.
Real model calls, translation review, clinical review, Ragas/Recall@K/MRR and
production ingestion/deployment remain separate validation steps.
