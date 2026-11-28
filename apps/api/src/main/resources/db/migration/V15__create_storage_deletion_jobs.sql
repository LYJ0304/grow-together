-- Outlives the account; deliberately no FK to users/stored_files.
CREATE TABLE storage_deletion_jobs (
    object_key VARCHAR(1024) PRIMARY KEY,
    next_attempt_at TIMESTAMPTZ NOT NULL,
    final_after TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ix_storage_deletion_due ON storage_deletion_jobs(next_attempt_at);
