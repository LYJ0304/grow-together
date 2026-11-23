ALTER TABLE child_profile
    ADD COLUMN gender VARCHAR(6),
    ADD CONSTRAINT child_profile_gender_check CHECK (gender IN ('MALE', 'FEMALE'));
