CREATE TABLE todo (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_name VARCHAR(80) NOT NULL,
    content VARCHAR(255),
    scheduled_date DATE NOT NULL,
    scheduled_time TIME(6) WITHOUT TIME ZONE NOT NULL
);

CREATE INDEX ix_todo_scheduled_date_time ON todo(scheduled_date, scheduled_time);
