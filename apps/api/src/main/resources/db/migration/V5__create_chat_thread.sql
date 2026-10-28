-- Only ownership is persisted; message history currently lives in the client session.
CREATE TABLE chat_thread (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id)
);
CREATE INDEX ix_chat_thread_user_id ON chat_thread(user_id);
