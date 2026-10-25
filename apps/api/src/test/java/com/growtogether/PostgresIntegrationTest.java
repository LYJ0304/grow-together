package com.growtogether;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.growtogether.auth.AuthRepository;
import com.growtogether.user.User;
import com.growtogether.todo.Todo;
import com.growtogether.todo.TodoRepository;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.transaction.annotation.Transactional;
import org.flywaydb.core.Flyway;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import java.sql.Connection;
import java.sql.DriverManager;

@ActiveProfiles("test")
@SpringBootTest(properties = {
        "spring.datasource.driver-class-name=org.postgresql.Driver",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@Testcontainers(disabledWithoutDocker = true)
class PostgresIntegrationTest {
    @Autowired private TodoRepository todoRepository;
    @Autowired private EntityManager entityManager;
    @Autowired private AuthRepository users;
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Test void contextLoadsWithPostgres() { }

    @Test
    void migratesLinkedOwnersAndPreservesUnownedLegacyTodos() throws Exception {
        String schema = "todo_ownership_upgrade";
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .schemas(schema).defaultSchema(schema).target("3").load().migrate();
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            connection.setSchema(schema);
            JdbcTemplate jdbc = new JdbcTemplate(new SingleConnectionDataSource(connection, true));
            Long userId = jdbc.queryForObject("""
                    INSERT INTO users (name, email, password_hash)
                    VALUES ('Owner', 'legacy@example.com', 'unused-test-hash') RETURNING id
                    """, Long.class);
            Long diaryId = jdbc.queryForObject("INSERT INTO diary (user_id, content) VALUES (?, 'Private') RETURNING id",
                    Long.class, userId);
            Long linkedId = jdbc.queryForObject("""
                    INSERT INTO todo (plan_name, content, scheduled_date, scheduled_time, diary_id)
                    VALUES ('Linked', 'Keep linked', '2026-10-10', '09:00', ?) RETURNING id
                    """, Long.class, diaryId);
            Long unownedId = jdbc.queryForObject("""
                    INSERT INTO todo (plan_name, content, scheduled_date, scheduled_time)
                    VALUES ('Unowned', 'Keep unowned', '2026-10-10', '10:00') RETURNING id
                    """, Long.class);

            Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                    .schemas(schema).defaultSchema(schema).load().migrate();

            assertThat(jdbc.queryForObject("SELECT user_id FROM todo WHERE id = ?", Long.class, linkedId))
                    .isEqualTo(userId);
            assertThat(jdbc.queryForObject("SELECT diary_id FROM todo WHERE id = ?", Long.class, linkedId))
                    .isEqualTo(diaryId);
            assertThat(jdbc.queryForObject("SELECT user_id FROM todo WHERE id = ?", Long.class, unownedId)).isNull();
            assertThat(jdbc.queryForList("SELECT content FROM todo ORDER BY id", String.class))
                    .containsExactly("Keep linked", "Keep unowned");
            assertThatThrownBy(() -> jdbc.update("UPDATE todo SET user_id = ? WHERE id = ?", Long.MAX_VALUE, unownedId))
                    .isInstanceOf(DataIntegrityViolationException.class);
        }
    }

    @Test
    @Transactional
    void savesAndReadsTodoUsingMigratedSchema() {
        LocalDate date = LocalDate.of(2026, 10, 10);
        LocalTime time = LocalTime.of(9, 30);
        Long userId = users.saveAndFlush(new User("Owner", "owner@example.com", "unused-test-hash")).getId();
        Todo todo = todoRepository.saveAndFlush(new Todo(userId, "Walk", null, date, time));
        Long id = todo.getId();
        entityManager.clear();

        Todo saved = todoRepository.findById(id).orElseThrow();
        assertThat(id).isPositive();
        assertThat(saved.getUserId()).isEqualTo(userId);
        assertThat(saved.getPlanName()).isEqualTo("Walk");
        assertThat(saved.getContent()).isNull();
        assertThat(saved.getScheduledDate()).isEqualTo(date);
        assertThat(saved.getScheduledTime()).isEqualTo(time);
        assertThat(todoRepository.findByUserIdAndScheduledDateOrderByScheduledTimeAsc(userId, date))
                .extracting(Todo::getId).containsExactly(id);
    }
}
