package com.growtogether.common.exception;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.growtogether.auth.AuthRepository;
import com.growtogether.diary.DiaryRepository;
import com.growtogether.user.User;
import com.growtogether.todo.Todo;
import com.growtogether.todo.TodoRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@ActiveProfiles("test")
@SpringBootTest(properties = {
        "spring.datasource.driver-class-name=org.postgresql.Driver",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class TodoApiTest {
    private static final LocalDate DATE = LocalDate.of(2026, 10, 10);
    @Autowired private TodoRepository repository;
    @Autowired private AuthRepository users;
    @Autowired private DiaryRepository diaries;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private MockMvc mvc;
    private Long ownerId;
    private Long otherUserId;
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @BeforeEach
    void setUp() {
        repository.deleteAll();
        diaries.deleteAll();
        users.deleteAll();
        ownerId = users.save(new User("Owner", "owner@example.com", "unused-test-hash")).getId();
        otherUserId = users.save(new User("Other", "other@example.com", "unused-test-hash")).getId();
    }

    @Test
    void listsOnlySelectedDateInTimeOrderAndReturnsEmptyArray() throws Exception {
        save("Late", DATE, "17:00");
        save("Other date", DATE.plusDays(1), "07:00");
        save("Early", DATE, "09:00");
        repository.save(new Todo(otherUserId, "Private", "Memo", DATE, LocalTime.of(8, 0)));
        perform(get("/api/v1/todos").param("date", DATE.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].planName").value("Early"))
                .andExpect(jsonPath("$[1].planName").value("Late"));
        perform(get("/api/v1/todos").param("date", DATE.plusDays(2).toString()))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    @Test
    void readsSingleTodoAndRejectsInvalidParameters() throws Exception {
        Todo todo = save("Walk", DATE, "09:00");
        perform(get("/api/v1/todos/{id}", todo.getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(todo.getId()))
                .andExpect(jsonPath("$.planName").value("Walk"));
        perform(get("/api/v1/todos")).andExpect(status().isBadRequest());
        perform(get("/api/v1/todos").param("date", "abc")).andExpect(status().isBadRequest());
        perform(get("/api/v1/todos/abc")).andExpect(status().isBadRequest());
    }

    @Test
    void updatesAllFieldsAndCommitsWithoutExplicitSave() throws Exception {
        Todo todo = save("Before", DATE, "09:00");
        perform(put("/api/v1/todos/{id}", todo.getId()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"planName":"After","content":null,"scheduledDate":"2026-10-11","scheduledTime":"14:30"}
                        """))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(todo.getId()))
                .andExpect(jsonPath("$.planName").value("After"));
        Todo updated = repository.findById(todo.getId()).orElseThrow();
        assertThat(updated.getUserId()).isEqualTo(ownerId);
        assertThat(updated.getPlanName()).isEqualTo("After");
        assertThat(updated.getContent()).isNull();
        assertThat(updated.getScheduledDate()).isEqualTo(DATE.plusDays(1));
        assertThat(updated.getScheduledTime()).isEqualTo(LocalTime.of(14, 30));
    }

    @Test
    void rejectsInvalidUpdateWithoutChangingSavedData() throws Exception {
        Todo todo = save("Before", DATE, "09:00");
        perform(put("/api/v1/todos/{id}", todo.getId()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"planName":" ","scheduledDate":"2026-10-11","scheduledTime":"14:30"}
                        """))
                .andExpect(status().isBadRequest());
        assertThat(repository.findById(todo.getId()).orElseThrow().getPlanName()).isEqualTo("Before");
    }

    @Test
    void deletesTodoAndReturns404ForMissingReadUpdateAndDelete() throws Exception {
        Todo todo = save("Walk", DATE, "09:00");
        perform(delete("/api/v1/todos/{id}", todo.getId()))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(repository.findById(todo.getId())).isEmpty();
        perform(get("/api/v1/todos/{id}", todo.getId()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        perform(put("/api/v1/todos/{id}", todo.getId()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"planName":"Walk","scheduledDate":"2026-10-10","scheduledTime":"09:00"}
                        """))
                .andExpect(status().isNotFound());
        perform(delete("/api/v1/todos/{id}", todo.getId())).andExpect(status().isNotFound());
    }

    @Test
    void createsTodoForAuthenticatedUserEvenIfBodyClaimsAnotherOwner() throws Exception {
        perform(post("/api/v1/todos").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"userId":%d,"planName":"Walk","scheduledDate":"2026-10-10","scheduledTime":"09:00"}
                        """.formatted(otherUserId)))
                .andExpect(status().isCreated());
        assertThat(repository.findAll()).singleElement().satisfies(todo -> {
            assertThat(todo.getUserId()).isEqualTo(ownerId);
            assertThat(todo.getPlanName()).isEqualTo("Walk");
        });
    }

    @Test
    void anotherUserCannotReadUpdateOrDeleteTodo() throws Exception {
        Todo todo = repository.save(new Todo(otherUserId, "Private", "Memo", DATE, LocalTime.of(9, 0)));
        assertInaccessible(todo.getId());
        mvc.perform(post("/api/v1/diary").with(jwt().jwt(token -> token.subject(otherUserId.toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"content":"Private diary","todoIds":[%d],"diaryFiles":[]}
                        """.formatted(todo.getId())))
                .andExpect(status().isCreated());
        assertInaccessible(todo.getId());
        Todo unchanged = repository.findById(todo.getId()).orElseThrow();
        assertThat(unchanged.getUserId()).isEqualTo(otherUserId);
        assertThat(unchanged.getPlanName()).isEqualTo("Private");
    }

    @Test
    void ownerlessLegacyTodoIsPreservedButInaccessible() throws Exception {
        Long id = jdbc.queryForObject("""
                INSERT INTO todo (plan_name, scheduled_date, scheduled_time)
                VALUES ('Legacy', '2026-10-10', '09:00') RETURNING id
                """, Long.class);
        assertInaccessible(id);
        perform(get("/api/v1/todos").param("date", DATE.toString()))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        perform(post("/api/v1/diary").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"content":"Claim legacy","todoIds":[%d],"diaryFiles":[]}
                        """.formatted(id)))
                .andExpect(status().isNotFound());
        assertThat(repository.findById(id)).isPresent();
        assertThat(repository.findById(id).orElseThrow().getUserId()).isNull();
    }

    @Test
    void allOperationsRequireAuthentication() throws Exception {
        Todo todo = save("Private", DATE, "09:00");
        mvc.perform(post("/api/v1/todos").contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/todos").param("date", DATE.toString()))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/todos/{id}", todo.getId())).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/v1/todos/{id}", todo.getId())
                .contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/todos/{id}", todo.getId())).andExpect(status().isUnauthorized());
        assertThat(repository.count()).isEqualTo(1);
        assertThat(repository.findById(todo.getId()).orElseThrow().getPlanName()).isEqualTo("Private");
    }

    private void assertInaccessible(Long id) throws Exception {
        perform(get("/api/v1/todos/{id}", id)).andExpect(status().isNotFound());
        perform(put("/api/v1/todos/{id}", id).contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isNotFound());
        perform(delete("/api/v1/todos/{id}", id)).andExpect(status().isNotFound());
    }

    private ResultActions perform(MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request.with(jwt().jwt(token -> token.subject(ownerId.toString()))));
    }

    private static String validBody() {
        return """
                {"planName":"Changed","scheduledDate":"2026-10-10","scheduledTime":"09:00"}
                """;
    }

    private Todo save(String name, LocalDate date, String time) {
        return repository.save(new Todo(ownerId, name, "Memo", date, LocalTime.parse(time)));
    }
}
