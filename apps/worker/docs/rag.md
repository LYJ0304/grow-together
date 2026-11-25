# Vanilla RAG (Worker-only)

This completes the optional execution layer in #240 on top of #239's isolated
storage. It is **not** connected to chat, schedules, diaries, or reports. No
production documents are loaded and no live provider/corpus quality is implied
by fixture tests. Private child profiles, diaries and conversations are not an
approved corpus for this shared-collection endpoint.

## Initial embedding space and limits

| Item | Initial choice |
| --- | --- |
| Provider | OpenRouter embeddings API, existing OPENROUTER_API_KEY |
| Embedding model | openai/text-embedding-3-small |
| Dimensions / metric | 1536 / cosine |
| Chunking | NFC + LF normalization, 800 Unicode characters, 120 overlap |
| Search | Exact cosine search; default Top-K 4, maximum 10 |
| Minimum similarity | 0.35, provisional and configurable within [0, 1] |
| Document | 100,000 characters AND 200,000 UTF-8 bytes; at most 160 chunks |
| Embedding batch | At most 16 texts, each at most 8,000 UTF-8 bytes |
| Embedding response | At most 2 MiB; explicit index, model, dimension and finite/nonzero float32 validation |
| Question / HTTP body | 2,000 characters / 16 KiB, including chunked requests |
| Context / answer | Sources JSON at most 12,000 characters; answer at most 6,000 characters |
| Generation | Existing LLM_CHAT_MODEL, JSON mode, maximum 1,024 output tokens |
| Deadlines | Body 10s, embedding batch 25s (HTTP timeout 20s), query 45s, single-document ingestion 300s |
| Pool | Reader max 4 / writer max 1; wait/connect/statement 3s, lock 2s; bounded reconnect window 3s |

There is no reranking, hybrid/ANN search, query rewriting, agent/tool execution or
model training. External embedding calls have no automatic retry. The generation
client keeps its existing 30s timeout and no-retry policy; the query's overall
45s deadline also applies. Input and output limits bound work, not a monetary
budget or a guarantee of tokenization/answer quality.

The SQL vector dimension is deliberately fixed at 1536 in migration 0002. Each
collection stores model, dimension, distance metric and chunk configuration.
The CLI/query reject mismatches before mixing embeddings. Changing the embedding
model requires a new collection and re-embedding; another dimension requires an
explicit schema migration, not a changed environment value. RAG_EMBEDDING_MODEL
can select another compatible 1536-dimensional model in a new collection, but
only the initial model above is the selected baseline; alternatives need separate
live compatibility/quality evaluation.

## Provisioning and activation

Follow [RAG PostgreSQL](../../../infra/docs/rag-postgres.md) first. Run the existing
rag-migrate job on both fresh and existing RAG volumes; append migration 0002,
never edit applied 0001 or its history. `rag_reader` can only read; `rag_ingest`
can atomically replace documents/chunks; `rag_migrator` owns DDL.

Runtime settings (Compose takes them from the infra env file):

- RAG_ENABLED=false by default. Disabled startup creates no pool and makes no DB
  or embedding call. Existing Worker routes work without RAG configuration.
- RAG_DATABASE_URL: **rag_reader** in growtogether_rag, with URL-encoded password.
- RAG_EMBEDDING_MODEL: initial model above (default when absent).
- RAG_MIN_SIMILARITY: provisional 0.35; evaluate before production use.

Enabled startup validates the dedicated role/database URL and constructs a lazy
pool. A DB outage produces a RAG 503, not a fake empty result; it does not require
other Worker functions to use this database. Shutdown closes the pool even after
startup/processing failures. Use sslmode=verify-full and sslrootcert where a
managed deployment needs certificate validation. Service/options query overrides
and the API/admin/ingestion usernames are rejected for runtime connections.

## Operator-only text ingestion

Only normalized UTF-8 text is accepted; there is no upload/ingestion HTTP API, PDF
parser, crawler, remote-source fetch, or production corpus. `source` is metadata,
not a URL the Worker visits.

Provide OPENROUTER_API_KEY and **RAG_INGEST_DATABASE_URL** only to the operator
process via its environment/secret manager. The CLI deliberately does not load
.env and does not require AI_WORKER_API_KEY, generation model settings or
RAG_ENABLED. Do not save the write DSN in apps/worker/.env: Compose loads that
file into the runtime service. Never use the administrator/migration role.

Example against a disposable test environment only, from apps/worker:

```sh
uv run python -m app.features.rag.cli \
  --collection fixture-reading-v1 --document-id reading \
  --title 'Synthetic fixture' --source 'fixture://reading' \
  --file tests/fixtures/rag/reading.txt
```

For a one-shot Compose CLI, mount only the intended text file read-only and pass
`-e RAG_INGEST_DATABASE_URL` from the operator environment to that one container;
do not add the write DSN to the Worker service definition. Override the Worker
command with `uv run --no-sync python -m app.features.rag.cli ...`. Its existing
ai+rag networks provide provider access plus RAG storage, not service DB access.

Successful output is JSON with status updated/unchanged and collection/document
IDs, never document text or DSNs. Failures return exit code 2 with a sanitized
error category. There is no automatic paid re-embedding retry.

NFC/LF normalized text is hashed. The same ID/hash/title/source skips embedding
and writes. A changed document stages all embeddings **before** opening the
replacement transaction. One transaction changes its metadata/revision and all
chunks; DB/provider failure preserves the prior version. A per-document advisory
lock plus expected revision prevents a slower ingestion overwriting a newer
version. RagConflictError means the operator should inspect and retry explicitly.
Atomicity is per document; the CLI accepts one document per invocation.

## Internal query contract

`POST /internal/v1/rag/query` uses the existing **X-API-Key** service key, not an
end-user JWT. No Spring API/Mobile consumer is added. FastAPI's /openapi.json is
the internal schema; contracts/openapi.yaml remains the unchanged external Spring
contract. Schema/auth/error tests verify the new operation.

```json
{"collection":"fixture-reading-v1","question":"책을 함께 읽을까요?","top_k":4}
```

An answered response has status answered, reason null, nonempty content, configured
generation model and sources. Each source contains reference_id (S1 etc.),
collection, document_id, immutable document revision UUID, ordinal, title, source,
excerpt and similarity. Sources are actual retrieved/context-provided records;
unknown/unlisted citation IDs, malformed JSON and oversized answers are rejected.
The model field names the configured generation model, not attestation of the
provider's actual routing. Citation linkage does not prove semantic entailment or
factual accuracy.

An empty/irrelevant collection returns HTTP 200 without invoking generation:

```json
{"status":"no_context","reason":"no_documents","content":null,"model":null,"sources":[]}
```

Reasons are collection_not_found, no_documents, no_relevant_chunks. Missing/empty
collections also skip embedding. This is distinct from database/provider errors.

| HTTP | detail.code / meaning |
| --- | --- |
| 401 | Existing service-key authentication error (detail string Unauthorized) |
| 408 | RAG_BODY_TIMEOUT |
| 409 | RAG_COLLECTION_MISMATCH |
| 413 | RAG_BODY_TOO_LARGE |
| 422 | FastAPI request validation (blank/oversized question, Top-K outside 1–10, extra fields, etc.) |
| 502 | RAG_EMBEDDING_FAILED or RAG_GENERATION_FAILED |
| 503 | RAG_UNAVAILABLE (disabled) or RAG_STORAGE_UNAVAILABLE |
| 504 | RAG_TIMEOUT |

RAG-specific errors use {"detail":{"code":"...","message":"..."}} with fixed
messages, never provider errors, original text or connection credentials. Logs
record status, duration and retrieval/source counts without questions, document
content or DSNs. SDK/DB diagnostics must also remain at normal, non-debug levels;
do not enable raw HTTP/SQL payload logging for sensitive corpora.

Reference text and metadata are serialized as untrusted user-message data, not
system instructions. The model receives no tools. Tests include instruction-like
source text and verify this boundary/citation allow-list; they do not establish
that a real model resists every prompt injection.

## Verification and remaining work

```sh
python3 infra/tests/test_rag_compose.py
python3 infra/tests/test_rag_postgres.py
cd apps/worker
uv sync --locked
uv run ruff check .
uv run pytest
```

Worker PostgreSQL integration tests are opt-in and otherwise explicitly skipped.
To run them, use an unused **disposable** rag-239-test* container name. From the
repository root (all credentials below are test-only):

```sh
docker run -d --name rag-239-test --publish 127.0.0.1::5432 \
  --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_DB=growtogether_rag -e POSTGRES_USER=rag_admin \
  -e POSTGRES_PASSWORD=test-admin-only pgvector/pgvector:0.8.2-pg16
RAG_TEST_CONTAINER=rag-239-test python3 infra/tests/test_rag_postgres.py
cd apps/worker
RAG_TEST_CONTAINER=rag-239-test uv run pytest tests/test_rag_postgres.py
# Only the disposable fixture created above; never a retained/production database.
docker rm -f rag-239-test
```

The infra test resets that fixture, applies all migrations and provisions the
dummy reader/ingestion/migration passwords used by the Worker integration tests.
Do not point it at an existing retained environment.

They use real pgvector for ingestion/search/order, idempotency, rollback, revision
conflicts, role separation, reader/writer pool closure and CLI behavior. Model
calls are deterministic fixtures, not paid calls. Unit/HTTP tests cover malformed
embeddings, empty retrieval, evidence validation, deadlines/errors, body limits,
disabled startup and lifecycle cleanup. No production fixture is auto-loaded.

Before connecting an existing product flow: select licensed/reviewed documents,
define update/deletion ownership, evaluate chunking/threshold/Top-K and real-model
citation quality, validate the chosen embedding/generation models live, and define
any tenant authorization needed. Public fixture tests do not make this an approved
medical knowledge base or a production-ready personal-document retrieval system.
