package com.growtogether.common.exception;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.growtogether.todo.Todo;
import com.growtogether.todo.TodoController;
import com.growtogether.todo.TodoRepository;
import com.growtogether.todo.TodoService;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@DataJpaTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
@Import(TodoService.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class TodoApiTest {
    private static final LocalDate DATE = LocalDate.of(2026, 10, 10);
    @Autowired private TodoRepository repository;
    @Autowired private TodoService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        repository.deleteAll();
        mvc = MockMvcBuilders.standaloneSetup(new TodoController(service))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @Test
    void listsOnlySelectedDateInTimeOrderAndReturnsEmptyArray() throws Exception {
        save("Late", DATE, "17:00");
        save("Other date", DATE.plusDays(1), "07:00");
        save("Early", DATE, "09:00");
        mvc.perform(get("/api/v1/todos").param("date", DATE.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].planName").value("Early"))
                .andExpect(jsonPath("$[1].planName").value("Late"));
        mvc.perform(get("/api/v1/todos").param("date", DATE.plusDays(2).toString()))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    @Test
    void readsSingleTodoAndRejectsInvalidParameters() throws Exception {
        Todo todo = save("Walk", DATE, "09:00");
        mvc.perform(get("/api/v1/todos/{id}", todo.getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(todo.getId()))
                .andExpect(jsonPath("$.planName").value("Walk"));
        mvc.perform(get("/api/v1/todos")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/todos").param("date", "abc")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/todos/abc")).andExpect(status().isBadRequest());
    }

    @Test
    void updatesAllFieldsAndCommitsWithoutExplicitSave() throws Exception {
        Todo todo = save("Before", DATE, "09:00");
        mvc.perform(put("/api/v1/todos/{id}", todo.getId()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"planName":"After","content":null,"scheduledDate":"2026-10-11","scheduledTime":"14:30"}
                        """))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(todo.getId()))
                .andExpect(jsonPath("$.planName").value("After"));
        Todo updated = repository.findById(todo.getId()).orElseThrow();
        assertThat(updated.getPlanName()).isEqualTo("After");
        assertThat(updated.getContent()).isNull();
        assertThat(updated.getScheduledDate()).isEqualTo(DATE.plusDays(1));
        assertThat(updated.getScheduledTime()).isEqualTo(LocalTime.of(14, 30));
    }

    @Test
    void rejectsInvalidUpdateWithoutChangingSavedData() throws Exception {
        Todo todo = save("Before", DATE, "09:00");
        mvc.perform(put("/api/v1/todos/{id}", todo.getId()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"planName":" ","scheduledDate":"2026-10-11","scheduledTime":"14:30"}
                        """))
                .andExpect(status().isBadRequest());
        assertThat(repository.findById(todo.getId()).orElseThrow().getPlanName()).isEqualTo("Before");
    }

    @Test
    void deletesTodoAndReturns404ForMissingReadUpdateAndDelete() throws Exception {
        Todo todo = save("Walk", DATE, "09:00");
        mvc.perform(delete("/api/v1/todos/{id}", todo.getId()))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(repository.findById(todo.getId())).isEmpty();
        mvc.perform(get("/api/v1/todos/{id}", todo.getId()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(put("/api/v1/todos/{id}", todo.getId()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"planName":"Walk","scheduledDate":"2026-10-10","scheduledTime":"09:00"}
                        """))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/todos/{id}", todo.getId())).andExpect(status().isNotFound());
    }

    private Todo save(String name, LocalDate date, String time) {
        return repository.save(new Todo(name, "Memo", date, LocalTime.parse(time)));
    }
}
