-- Preserve unlinked legacy todos without guessing their owner; owner-scoped APIs exclude NULL.
ALTER TABLE todo ADD COLUMN user_id BIGINT REFERENCES users(id);

UPDATE todo t SET user_id = d.user_id FROM diary d WHERE t.diary_id = d.id;

DROP INDEX ix_todo_scheduled_date_time;
CREATE INDEX ix_todo_user_date_time ON todo(user_id, scheduled_date, scheduled_time);
