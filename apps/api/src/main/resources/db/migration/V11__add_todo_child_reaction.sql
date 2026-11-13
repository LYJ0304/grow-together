ALTER TABLE todo ADD COLUMN child_reaction VARCHAR(16);
ALTER TABLE todo ADD CONSTRAINT todo_child_reaction_values
    CHECK (child_reaction IN ('ENJOYED', 'NEUTRAL', 'DIFFICULT'));
ALTER TABLE todo ADD CONSTRAINT todo_reaction_requires_completion
    CHECK (completed OR child_reaction IS NULL);
