package com.growtogether.child;

import static org.assertj.core.api.Assertions.assertThat;
import java.sql.DriverManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {
        "spring.datasource.driver-class-name=org.postgresql.Driver",
        "spring.flyway.enabled=true", "spring.jpa.hibernate.ddl-auto=validate"
})
@Testcontainers(disabledWithoutDocker = true)
class PostgresChildPersonalizationTest extends ChildPersonalizationIntegrationTest {
    @Container static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Test void upgradesExistingProfilesWithoutChangingNamesOrCalendarDates() throws Exception {
        String schema = "child_personalization_upgrade";
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .schemas(schema).defaultSchema(schema).target("8").load().migrate();
        try (var connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            connection.setSchema(schema);
            var jdbc = new JdbcTemplate(new SingleConnectionDataSource(connection, true));
            Long owner = jdbc.queryForObject("""
                    INSERT INTO users(name,email,password_hash)
                    VALUES('Legacy','legacy-child@example.com','hash') RETURNING id
                    """, Long.class);
            jdbc.update("INSERT INTO child_profile(user_id,name,birthday) VALUES(?, 'Legacy child', '1582-10-10')", owner);
            Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                    .schemas(schema).defaultSchema(schema).load().migrate();
            assertThat(jdbc.queryForObject("SELECT name FROM child_profile WHERE user_id=?", String.class, owner))
                    .isEqualTo("Legacy child");
            assertThat(jdbc.queryForObject("SELECT birthday::text FROM child_profile WHERE user_id=?", String.class, owner))
                    .isEqualTo("1582-10-10");
            assertThat(jdbc.queryForObject("SELECT prematurity_status FROM child_profile WHERE user_id=?", String.class, owner))
                    .isNull();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM child_profile_concern", Long.class)).isZero();
            jdbc.update("INSERT INTO child_profile_concern(user_id,position,concern) VALUES(?,0,'sleep')", owner);
            jdbc.update("DELETE FROM users WHERE id=?", owner);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM child_profile_concern", Long.class)).isZero();
        }
    }
}
