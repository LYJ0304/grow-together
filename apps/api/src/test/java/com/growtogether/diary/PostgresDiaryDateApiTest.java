package com.growtogether.diary;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import java.sql.DriverManager;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {
    "spring.datasource.driver-class-name=org.postgresql.Driver", "spring.flyway.enabled=true",
    "spring.jpa.hibernate.ddl-auto=validate"
})
@Testcontainers(disabledWithoutDocker = true)
class PostgresDiaryDateApiTest extends DiaryDateIntegrationTest {
    @Container static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
    @Test void concurrentCreatesReturnOneCreatedAndOneConflict() throws Exception {
        var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<Integer> call = () -> {
                start.await(5, TimeUnit.SECONDS);
                return mvc.perform(post("/api/v1/diary").with(jwt().jwt(t -> t.subject(""+owner)))
                    .contentType(MediaType.APPLICATION_JSON).content(body("2026-11-10")))
                    .andReturn().getResponse().getStatus();
            };
            var a=pool.submit(call); var b=pool.submit(call); start.countDown();
            assertThat(java.util.List.of(a.get(15, TimeUnit.SECONDS),b.get(15, TimeUnit.SECONDS)))
                .containsExactlyInAnyOrder(201,409);
        }
        assertThat(diaries.count()).isEqualTo(1);
    }
    @Test void migrationPreservesUndatedRecordsAndAllowsMultipleNulls() throws Exception {
        String schema="diary_dates_upgrade";
        Flyway.configure().dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword())
            .schemas(schema).defaultSchema(schema).target("7").load().migrate();
        try(var connection=DriverManager.getConnection(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword())) {
            connection.setSchema(schema);
            var jdbc=new JdbcTemplate(new SingleConnectionDataSource(connection,true));
            Long user=jdbc.queryForObject("INSERT INTO users(name,email,password_hash) VALUES('Legacy','legacy-dates@example.com','hash') RETURNING id",Long.class);
            jdbc.update("INSERT INTO diary(user_id,content) VALUES(?,'Legacy one'),(?,'Legacy two')",user,user);
            Flyway.configure().dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword())
                .schemas(schema).defaultSchema(schema).load().migrate();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM diary WHERE diary_date IS NULL",Long.class)).isEqualTo(2);
            assertThat(jdbc.queryForList("SELECT content FROM diary ORDER BY id",String.class))
                .containsExactly("Legacy one","Legacy two");
        }
    }
}
