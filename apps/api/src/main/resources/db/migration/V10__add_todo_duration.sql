-- Preserve unknown legacy durations instead of inventing occupied intervals.
ALTER TABLE todo ADD COLUMN duration_minutes INTEGER;
ALTER TABLE todo ADD CONSTRAINT todo_duration_range
    CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440);
