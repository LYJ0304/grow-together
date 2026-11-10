-- Existing records have no reliable date. Keep them accessible by ID without guessing.
ALTER TABLE diary ADD COLUMN diary_date DATE;
ALTER TABLE diary ADD CONSTRAINT uq_diary_user_date UNIQUE (user_id, diary_date);
