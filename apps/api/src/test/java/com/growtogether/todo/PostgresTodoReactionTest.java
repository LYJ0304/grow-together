package com.growtogether.todo;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.growtogether.auth.AuthRepository;
import com.growtogether.user.User;
import java.sql.DriverManager;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.concurrent.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@ActiveProfiles("test")
@SpringBootTest(properties={"spring.datasource.driver-class-name=org.postgresql.Driver","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
@AutoConfigureMockMvc
@Testcontainers
class PostgresTodoReactionTest {
    @Container static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",postgres::getJdbcUrl);
        r.add("spring.datasource.username",postgres::getUsername);
        r.add("spring.datasource.password",postgres::getPassword);
    }
    @Autowired TodoService service;
    @Autowired TodoRepository todos;
    @Autowired AuthRepository users;
    @Autowired MockMvc mvc;
    @Autowired PlatformTransactionManager transactions;
    Long owner() { return users.save(new User("Owner", "reaction-"+System.nanoTime()+"@test.com", "hash")).getId(); }
    Todo create(Long owner) { return todos.save(new Todo(owner,"Walk","Memo",LocalDate.of(2026,11,13),LocalTime.of(9,0))); }
    @Test void persistsAndIsolatesReactionAndPreservesItOnOrdinaryEdit() throws Exception {
        var owner=owner(); var other=owner(); var todo=create(owner); var path="/api/v1/todos/"+todo.getId();
        mvc.perform(put(path+"/reaction").with(jwt().jwt(j->j.subject(owner.toString())))
            .contentType(MediaType.APPLICATION_JSON).content("{\"childReaction\":\"ENJOYED\"}")).andExpect(status().isConflict());
        service.setCompletion(owner,todo.getId(),true);
        service.setReaction(owner,todo.getId(),ChildReaction.ENJOYED);
        mvc.perform(get(path).with(jwt().jwt(j->j.subject(owner.toString()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.childReaction").value("ENJOYED"));
        mvc.perform(get("/api/v1/todos").param("date","2026-11-13").with(jwt().jwt(j->j.subject(owner.toString()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].childReaction").value("ENJOYED"));
        mvc.perform(put(path).with(jwt().jwt(j->j.subject(owner.toString())))
            .contentType(MediaType.APPLICATION_JSON).content("{\"planName\":\"Changed\",\"scheduledDate\":\"2026-11-13\",\"scheduledTime\":\"10:00\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.childReaction").value("ENJOYED"));
        mvc.perform(put(path+"/reaction").with(jwt().jwt(j->j.subject(other.toString())))
            .contentType(MediaType.APPLICATION_JSON).content("{\"childReaction\":null}")).andExpect(status().isNotFound());
        assertThat(service.getTodo(owner,todo.getId()).childReaction()).isEqualTo(ChildReaction.ENJOYED);
        service.setReaction(owner,todo.getId(),null);
        assertThat(todos.findById(todo.getId()).orElseThrow().getChildReaction()).isNull();
    }
    @Test void migratesExistingRowsAndEnforcesDatabaseInvariants() throws Exception {
        String schema="reaction_upgrade";
        Flyway.configure().dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword())
            .schemas(schema).defaultSchema(schema).target("10").load().migrate();
        try(var c=DriverManager.getConnection(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword())) {
            c.setSchema(schema);
            c.createStatement().executeUpdate("insert into todo(plan_name,scheduled_date,scheduled_time,completed) values ('legacy','2026-11-13','09:00',false),('done','2026-11-13','10:00',true)");
            Flyway.configure().dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword()).schemas(schema).defaultSchema(schema).load().migrate();
            var rows=c.createStatement().executeQuery("select child_reaction from todo");
            int count=0;while(rows.next()){assertThat(rows.getString(1)).isNull();count++;}assertThat(count).isEqualTo(2);
            assertThatThrownBy(()->c.createStatement().executeUpdate("update todo set child_reaction='ENJOYED' where completed=false"));
            assertThatThrownBy(()->c.createStatement().executeUpdate("update todo set child_reaction='UNKNOWN' where completed=true"));
        }
    }
    @Test void serializesUndoAgainstReactionInBothOrders() throws Exception {
        for(boolean undoFirst:new boolean[]{true,false}) {
            var owner=owner();var todo=create(owner);service.setCompletion(owner,todo.getId(),true);
            var locked=new CountDownLatch(1);var secondStarted=new CountDownLatch(1);
            try(var pool=Executors.newFixedThreadPool(2)) {
                var first=pool.submit(()->new TransactionTemplate(transactions).executeWithoutResult(tx->{
                    service.lockOwner(owner);
                    if(undoFirst)service.setCompletion(owner,todo.getId(),false);
                    else service.setReaction(owner,todo.getId(),ChildReaction.ENJOYED);
                    locked.countDown();
                    try { assertThat(secondStarted.await(10,TimeUnit.SECONDS)).isTrue(); }
                    catch(InterruptedException e){throw new RuntimeException(e);}
                }));
                var second=pool.submit(()->{
                    assertThat(locked.await(10,TimeUnit.SECONDS)).isTrue();secondStarted.countDown();
                    if(undoFirst) {
                        assertThatThrownBy(()->service.setReaction(owner,todo.getId(),ChildReaction.DIFFICULT))
                            .isInstanceOfSatisfying(ResponseStatusException.class,e->assertThat(e.getStatusCode().value()).isEqualTo(409));
                    } else service.setCompletion(owner,todo.getId(),false);
                    return true;
                });
                first.get(15,TimeUnit.SECONDS);second.get(15,TimeUnit.SECONDS);
                var result=service.getTodo(owner,todo.getId());assertThat(result.completed()).isFalse();assertThat(result.childReaction()).isNull();
            }
        }
    }
}
