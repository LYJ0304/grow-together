CREATE TABLE child_profile (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    birthday DATE NOT NULL
);
