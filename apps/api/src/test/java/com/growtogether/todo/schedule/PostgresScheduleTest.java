package com.growtogether.todo.schedule;

import static org.assertj.core.api.Assertions.*;
import static com.growtogether.todo.schedule.ScheduleDtos.*;
import com.growtogether.user.User;
import java.sql.DriverManager;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.concurrent.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties={"spring.datasource.driver-class-name=org.postgresql.Driver","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
@Testcontainers(disabledWithoutDocker=true)
class PostgresScheduleTest extends ScheduleIntegrationTest {
    @Container static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",postgres::getJdbcUrl);
        r.add("spring.datasource.username",postgres::getUsername);
        r.add("spring.datasource.password",postgres::getPassword);
    }
    @org.springframework.beans.factory.annotation.Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Test void databaseFailureRollsBackPreviouslyInsertedCandidate() {
        var owner=users.save(new User("Rollback","rollback-"+System.nanoTime()+"@example.com","test")).getId();
        var date=LocalDate.of(2026,11,13);
        jdbc.execute("alter table todo add constraint schedule_test_reject check (plan_name <> 'reject-rollback')");
        try {
            assertThatThrownBy(()->batch.save(owner,new BatchRequest(date,List.of(
                new Candidate("first",null,LocalTime.of(9,0),1),
                new Candidate("reject-rollback",null,LocalTime.of(9,1),1)))));
            assertThat(todos.findByUserIdAndScheduledDateOrderByScheduledTimeAsc(owner,date)).isEmpty();
        } finally { jdbc.execute("alter table todo drop constraint schedule_test_reject"); }
    }
    @Test void durationMigrationPreservesUnknownLegacyRows() throws Exception {
        String schema="duration_upgrade";
        var config=Flyway.configure().dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword()).schemas(schema).defaultSchema(schema);
        config.target("9").load().migrate();
        try(var connection=DriverManager.getConnection(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword())) {
            connection.setSchema(schema);
            connection.createStatement().executeUpdate("insert into todo(plan_name,scheduled_date,scheduled_time) values ('legacy','2026-11-10','09:00')");
            Flyway.configure().dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword()).schemas(schema).defaultSchema(schema).load().migrate();
            var rs=connection.createStatement().executeQuery("select plan_name,duration_minutes from todo");
            assertThat(rs.next()).isTrue();assertThat(rs.getString(1)).isEqualTo("legacy");assertThat(rs.getObject(2)).isNull();
            assertThatThrownBy(()->connection.createStatement().executeUpdate("update todo set duration_minutes=0"));
        }
    }
    @Test void concurrentConfirmationsCannotBothSaveConflictingCandidates() throws Exception {
        var owner=users.save(new User("Concurrent","concurrent-"+System.nanoTime()+"@example.com","test")).getId();
        var request=new BatchRequest(LocalDate.of(2026,11,12),List.of(new Candidate("read",null,LocalTime.of(9,0),5)));
        var barrier=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Boolean> save=()->{barrier.await();try{batch.save(owner,request);return true;}catch(org.springframework.web.server.ResponseStatusException e){assertThat(e.getStatusCode().value()).isEqualTo(409);return false;}};
            var first=pool.submit(save);var second=pool.submit(save);barrier.countDown();
            assertThat(List.of(first.get(15,TimeUnit.SECONDS),second.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
            assertThat(todos.findByUserIdAndScheduledDateOrderByScheduledTimeAsc(owner,request.date())).hasSize(1);
        }
    }
}
