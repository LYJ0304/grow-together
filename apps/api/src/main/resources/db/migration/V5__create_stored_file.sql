CREATE TABLE stored_file (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    object_key VARCHAR(512) NOT NULL UNIQUE,
    original_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL CHECK (size BETWEEN 1 AND 5242880),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'READY', 'FAILED', 'DELETING')),
    created_at TIMESTAMPTZ NOT NULL,
    upload_expires_at TIMESTAMPTZ NOT NULL,
    pending_expires_at TIMESTAMPTZ NOT NULL,
    uploaded_at TIMESTAMPTZ
);
CREATE INDEX idx_stored_file_cleanup ON stored_file(status, created_at);
CREATE INDEX idx_stored_file_user ON stored_file(user_id);
