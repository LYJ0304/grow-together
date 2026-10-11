package com.growtogether;

import static org.assertj.core.api.Assertions.assertThat;

import com.growtogether.todo.Todo;
import com.growtogether.todo.TodoRepository;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import java.security.SecureRandom;
import java.util.Base64;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class PostgresIntegrationTest {
    @Autowired private TodoRepository todoRepository;
    @Autowired private EntityManager entityManager;
    private static final String JWT_SECRET = Base64.getEncoder().encodeToString(new SecureRandom().generateSeed(32));
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("app.jwt.secret", () -> JWT_SECRET);
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Test void contextLoadsWithPostgres() { }

    @Test
    @Transactional
    void savesAndReadsTodoUsingMigratedSchema() {
        LocalDate date = LocalDate.of(2026, 10, 10);
        LocalTime time = LocalTime.of(9, 30);
        Todo todo = todoRepository.saveAndFlush(new Todo("Walk", null, date, time));
        Long id = todo.getId();
        entityManager.clear();

        Todo saved = todoRepository.findById(id).orElseThrow();
        assertThat(id).isPositive();
        assertThat(saved.getPlanName()).isEqualTo("Walk");
        assertThat(saved.getContent()).isNull();
        assertThat(saved.getScheduledDate()).isEqualTo(date);
        assertThat(saved.getScheduledTime()).isEqualTo(time);
        assertThat(todoRepository.findByScheduledDateOrderByScheduledTimeAsc(date))
                .extracting(Todo::getId).containsExactly(id);
    }
}
