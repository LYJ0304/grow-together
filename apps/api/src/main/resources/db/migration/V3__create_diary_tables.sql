CREATE TABLE diary (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    content VARCHAR(1000)
);

CREATE INDEX ix_diary_user_id ON diary(user_id);

CREATE TABLE diary_file (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    diary_id BIGINT NOT NULL REFERENCES diary(id) ON DELETE CASCADE,
    image_url VARCHAR(2048) NOT NULL
);

CREATE INDEX ix_diary_file_diary_id ON diary_file(diary_id);

ALTER TABLE todo ADD COLUMN diary_id BIGINT REFERENCES diary(id) ON DELETE SET NULL;
CREATE INDEX ix_todo_diary_id ON todo(diary_id);
