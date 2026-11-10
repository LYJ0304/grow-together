ALTER TABLE child_profile ADD COLUMN prematurity_status VARCHAR(7);
ALTER TABLE child_profile ADD COLUMN expected_due_date DATE;
ALTER TABLE child_profile ADD COLUMN available_activity_time VARCHAR(10);

ALTER TABLE child_profile ADD CONSTRAINT ck_child_prematurity_status
    CHECK (prematurity_status IS NULL OR prematurity_status IN ('yes', 'no', 'unknown'));
ALTER TABLE child_profile ADD CONSTRAINT ck_child_due_date
    CHECK (expected_due_date IS NULL OR
           (prematurity_status IS NOT NULL AND prematurity_status = 'yes' AND expected_due_date > birthday));
ALTER TABLE child_profile ADD CONSTRAINT ck_child_activity_time
    CHECK (available_activity_time IS NULL OR available_activity_time IN ('5min', '10min', '15to20min', 'flexible'));

CREATE TABLE child_profile_concern (
    user_id BIGINT NOT NULL REFERENCES child_profile(user_id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0 AND position < 2),
    concern VARCHAR(24) NOT NULL CHECK (concern IN (
        'sleep', 'feeding', 'emotion_expression', 'communication',
        'developmental_play', 'daily_habits', 'separation_anxiety', 'none')),
    PRIMARY KEY (user_id, position)
);
-- Legacy names and birthdays are untouched; nullable columns/empty concerns mean unanswered.
-- No observation rows exist until a source-reviewed question catalog is implemented.
-- Concern uniqueness/none exclusivity are validated before mutation under the existing owner lock.
