CREATE TABLE conversation (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX ix_conversation_user_id ON conversation(user_id, id);

CREATE TABLE chat_message (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('SYSTEM', 'USER', 'ASSISTANT')),
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'STREAMING', 'COMPLETED', 'FAILED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX ix_chat_message_conversation_id ON chat_message(conversation_id, id);
