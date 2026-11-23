ALTER TABLE diary_file ALTER COLUMN image_url DROP NOT NULL;
ALTER TABLE diary_file ADD COLUMN stored_file_id UUID REFERENCES stored_files(id);
ALTER TABLE diary_file ADD CONSTRAINT ck_diary_file_source
    CHECK ((image_url IS NOT NULL) <> (stored_file_id IS NOT NULL));
