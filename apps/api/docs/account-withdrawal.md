# Account withdrawal

`POST /api/v1/users/me/withdrawal` checks the current password and returns 204 after
one relational transaction removes the account, children/personalization, todos,
diaries/file links, stored-file metadata, sessions and refresh tokens. It queues
object deletion in the same transaction. No retention exception is currently
implemented for these domain rows. This is permanent; no recovery grace period.
An authenticated command is never automatically replayed. A lost response or 401
alone is not evidence of successful withdrawal. Sign in again to verify the state.
Passwords are never included in DTO string output or application logs.

## Object deletion and operations

`storage_deletion_jobs` deliberately has no account FK. The scheduler runs every
30 seconds (override `app.storage.deletion.poll-ms`) and locks at most 10 due jobs
with `FOR UPDATE SKIP LOCKED`. Failures use bounded exponential backoff, without
losing jobs on restart. A missing object counts as success. Inspect job count,
attempts and next_attempt_at in the DB; repeated warning messages indicate a
storage outage. Do not export keys or original filenames to logs.

An initial deletion is followed by a final deletion after the configured signed
URL lifetime plus one hour. This catches signed PUTs that recreate an object after
the first deletion. Deployment must enforce upload request durations below this
one-hour buffer. If longer uploads are allowed, increase the buffer before using
this policy. Existing signed GET links may remain valid until expiry or object
deletion; UI must not promise immediate physical erasure. The service must remain
running for queued jobs to execute; repeated failures remain pending until fixed.

The current StorageService.delete deletes the current key. Use an unversioned
bucket, or separately configure/test removal of noncurrent versions and delete
markers through the storage retention policy. Object-lock/legal hold, replicas,
backups and external model-provider logs are not erased by this endpoint. Review
those deployment policies separately; this implementation makes no legal retention
claim. Legacy externally hosted image URLs are not owned storage keys and are not
removed from third-party hosts.

## Concurrency and caches

The user row is locked before collecting files and deleting owned rows. PostgreSQL
FK locking prevents concurrent insertions from surviving account deletion. Failed
transactions roll back deletion jobs and relational changes together. Existing
requests may finish before withdrawal commits; new requests cannot use deleted
sessions. The local weekly-report cache is evicted after commit, and retired
in-flight jobs cannot republish cache entries. Other instances still validate the
user/session against the DB before returning new data; cache TTL remains bounded.
The shared RAG knowledge corpus and Worker interfaces are untouched.

The mobile client clears tokens, query cache and session drafts after success,
without calling logout again. The epoch guard prevents a late response from
clearing a newer session. Local credential deletion failures use the existing
storageError retry UI. Old unowned preview data is neither read nor deleted.

## Tests

AccountWithdrawalPostgresIntegrationTest uses PostgreSQL 16 via Testcontainers by
default. On a constrained environment it can use an isolated local PostgreSQL DB
with `WITHDRAWAL_POSTGRES_URL=jdbc:postgresql://127.0.0.1:55432/postgres` (test-only
username/password postgres). Never point this destructive fixture at service data.
Flyway is enabled and Hibernate validates the migrated schema.
