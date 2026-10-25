package com.growtogether.diary;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.growtogether.auth.AuthRepository;
import com.growtogether.todo.Todo;
import com.growtogether.todo.TodoRepository;
import com.growtogether.user.User;
import com.jayway.jsonpath.JsonPath;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class DiaryIntegrationTest {
    private static final String PATH = "/api/v1/diary";
    private static final String IMAGE = "https://example.com/diary.jpg";

    @Autowired private MockMvc mvc;
    @Autowired private DiaryRepository diaries;
    @Autowired private TodoRepository todos;
    @Autowired private AuthRepository users;
    @Autowired private JdbcTemplate jdbc;
    private Long ownerId;
    private Long otherUserId;

    @BeforeEach
    void setUp() {
        todos.deleteAll();
        diaries.deleteAll();
        users.deleteAll();
        ownerId = users.save(new User("Owner", "owner@example.com", "unused-test-hash")).getId();
        otherUserId = users.save(new User("Other", "other@example.com", "unused-test-hash")).getId();
    }

    @Test
    void createsAndReadsDiaryWithExistingTodoAndImage() throws Exception {
        Todo todo = saveTodo();
        long id = createDiary(body("Today", "[" + todo.getId() + "]", IMAGE));

        perform(get(PATH + "/{id}", id), ownerId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.content").value("Today"))
                .andExpect(jsonPath("$.todos.length()").value(1))
                .andExpect(jsonPath("$.todos[0].id").value(todo.getId()))
                .andExpect(jsonPath("$.todos[0].planName").value("Walk"))
                .andExpect(jsonPath("$.diaryFiles.length()").value(1))
                .andExpect(jsonPath("$.diaryFiles[0].imageUrl").value(IMAGE));
        assertThat(diaries.count()).isEqualTo(1);
        assertThat(todos.count()).isEqualTo(1);
        assertThat(linkedDiary(todo.getId())).isEqualTo(id);
    }

    @Test
    void replacesContentImagesAndTodoLinksWithoutDeletingTodos() throws Exception {
        Todo previous = saveTodo();
        Todo replacement = saveTodo();
        long id = createDiary(body("Before", "[" + previous.getId() + "]", IMAGE));
        String newImage = "https://example.com/updated.jpg";

        perform(put(PATH + "/{id}", id).contentType(MediaType.APPLICATION_JSON)
                .content(body("After", "[" + replacement.getId() + "]", newImage)), ownerId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.content").value("After"));

        perform(get(PATH + "/{id}", id), ownerId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("After"))
                .andExpect(jsonPath("$.todos.length()").value(1))
                .andExpect(jsonPath("$.todos[0].id").value(replacement.getId()))
                .andExpect(jsonPath("$.diaryFiles.length()").value(1))
                .andExpect(jsonPath("$.diaryFiles[0].imageUrl").value(newImage));
        assertThat(todos.count()).isEqualTo(2);
        assertThat(linkedDiary(previous.getId())).isNull();
        assertThat(linkedDiary(replacement.getId())).isEqualTo(id);
        assertThat(imageCount()).isEqualTo(1);
    }

    @Test
    void deletesDiaryAndImagesButPreservesTodo() throws Exception {
        Todo todo = saveTodo();
        long id = createDiary(body("Today", "[" + todo.getId() + "]", IMAGE));

        perform(delete(PATH + "/{id}", id), ownerId)
                .andExpect(status().isNoContent()).andExpect(content().string(""));

        assertThat(diaries.existsById(id)).isFalse();
        assertThat(imageCount()).isZero();
        assertThat(todos.existsById(todo.getId())).isTrue();
        assertThat(linkedDiary(todo.getId())).isNull();
        perform(get(PATH + "/{id}", id), ownerId).andExpect(status().isNotFound());
    }

    @Test
    void allOperationsRequireAuthentication() throws Exception {
        String request = body("Today", "[]", null);
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isUnauthorized());
        mvc.perform(get(PATH + "/1")).andExpect(status().isUnauthorized());
        mvc.perform(put(PATH + "/1").contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete(PATH + "/1")).andExpect(status().isUnauthorized());
        assertThat(diaries.count()).isZero();
    }

    @Test
    void anotherUserCannotReadUpdateOrDeleteDiary() throws Exception {
        long id = createDiary(body("Private", "[]", IMAGE));

        perform(get(PATH + "/{id}", id), otherUserId).andExpect(status().isNotFound());
        perform(put(PATH + "/{id}", id).contentType(MediaType.APPLICATION_JSON)
                .content(body("Changed", "[]", null)), otherUserId).andExpect(status().isNotFound());
        perform(delete(PATH + "/{id}", id), otherUserId).andExpect(status().isNotFound());

        perform(get(PATH + "/{id}", id), ownerId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("Private"))
                .andExpect(jsonPath("$.diaryFiles[0].imageUrl").value(IMAGE));
    }

    @Test
    void anotherUserCannotTakeTodoLinkedToPrivateDiary() throws Exception {
        Todo todo = saveTodo();
        long privateDiaryId = createDiary(body("Private", "[" + todo.getId() + "]", IMAGE));
        String otherResponse = perform(post(PATH).contentType(MediaType.APPLICATION_JSON)
                .content(body("Other diary", "[]", null)), otherUserId)
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long otherDiaryId = ((Number) JsonPath.read(otherResponse, "$.id")).longValue();
        String request = body("Take todo", "[" + todo.getId() + "]", null);

        perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(request), otherUserId)
                .andExpect(status().isNotFound());
        perform(put(PATH + "/{id}", otherDiaryId).contentType(MediaType.APPLICATION_JSON)
                .content(request), otherUserId).andExpect(status().isNotFound());

        assertThat(linkedDiary(todo.getId())).isEqualTo(privateDiaryId);
        assertThat(diaries.count()).isEqualTo(2);
        perform(get(PATH + "/{id}", otherDiaryId), otherUserId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("Other diary"))
                .andExpect(jsonPath("$.todos").isEmpty());
    }

    @Test
    void anotherUserCannotLinkUnattachedTodoOnCreateOrUpdate() throws Exception {
        Todo todo = todos.save(new Todo(otherUserId, "Private", "Memo",
                LocalDate.of(2026, 10, 17), LocalTime.of(9, 0)));
        String request = body("Take todo", "[" + todo.getId() + "]", IMAGE);
        perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(request), ownerId)
                .andExpect(status().isNotFound());
        assertThat(diaries.count()).isZero();
        assertThat(imageCount()).isZero();

        Todo ownTodo = saveTodo();
        long diaryId = createDiary(body("Before", "[" + ownTodo.getId() + "]", IMAGE));
        perform(put(PATH + "/{id}", diaryId).contentType(MediaType.APPLICATION_JSON)
                .content(body("Take todo", "[" + ownTodo.getId() + "," + todo.getId() + "]", null)), ownerId)
                .andExpect(status().isNotFound());
        assertThat(linkedDiary(todo.getId())).isNull();
        assertThat(linkedDiary(ownTodo.getId())).isEqualTo(diaryId);
        perform(get(PATH + "/{id}", diaryId), ownerId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("Before"))
                .andExpect(jsonPath("$.todos.length()").value(1))
                .andExpect(jsonPath("$.diaryFiles[0].imageUrl").value(IMAGE));
    }

    @Test
    void detachingOrDeletingDiaryDoesNotChangeTodoOwnership() throws Exception {
        Todo detached = saveTodo();
        long diaryId = createDiary(body("Before", "[" + detached.getId() + "]", null));
        perform(put(PATH + "/{id}", diaryId).contentType(MediaType.APPLICATION_JSON)
                .content(body("After", "[]", null)), ownerId).andExpect(status().isOk());
        Todo linked = saveTodo();
        perform(put(PATH + "/{id}", diaryId).contentType(MediaType.APPLICATION_JSON)
                .content(body("After", "[" + linked.getId() + "]", null)), ownerId).andExpect(status().isOk());
        perform(delete(PATH + "/{id}", diaryId), ownerId).andExpect(status().isNoContent());

        for (Todo todo : new Todo[] {detached, linked}) {
            assertThat(todos.findById(todo.getId()).orElseThrow().getUserId()).isEqualTo(ownerId);
            perform(post(PATH).contentType(MediaType.APPLICATION_JSON)
                    .content(body("Take detached todo", "[" + todo.getId() + "]", null)), otherUserId)
                    .andExpect(status().isNotFound());
        }
    }

    @Test
    void missingDiaryReturns404ForReadUpdateAndDelete() throws Exception {
        long missingId = Long.MAX_VALUE;
        perform(get(PATH + "/{id}", missingId), ownerId)
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        perform(put(PATH + "/{id}", missingId).contentType(MediaType.APPLICATION_JSON)
                .content(body("Today", "[]", null)), ownerId).andExpect(status().isNotFound());
        perform(delete(PATH + "/{id}", missingId), ownerId).andExpect(status().isNotFound());
    }

    @Test
    void accepts1000CharactersAndRejectsLongerContentWithoutChangingDiary() throws Exception {
        String allowed = "a".repeat(1000);
        long id = createDiary(body(allowed, "[]", null));
        String tooLong = body("a".repeat(1001), "[]", null);

        perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(tooLong), ownerId)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        perform(put(PATH + "/{id}", id).contentType(MediaType.APPLICATION_JSON).content(tooLong), ownerId)
                .andExpect(status().isBadRequest());
        perform(get(PATH + "/{id}", id), ownerId)
                .andExpect(status().isOk()).andExpect(jsonPath("$.content").value(allowed));
        assertThat(diaries.count()).isEqualTo(1);
    }

    @Test
    void rejectsMalformedJsonAndInvalidId() throws Exception {
        perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("{"), ownerId)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        perform(get(PATH + "/not-a-number"), ownerId).andExpect(status().isBadRequest());
        assertThat(diaries.count()).isZero();
    }

    @Test
    void rejectsMissingListsInvalidTodoIdsAndInvalidImages() throws Exception {
        for (String request : new String[] {
                "{\"content\":\"Today\"}",
                "{\"todoIds\":null,\"diaryFiles\":[]}",
                "{\"todoIds\":[],\"diaryFiles\":null}",
                "{\"todoIds\":[null],\"diaryFiles\":[]}",
                "{\"todoIds\":[0],\"diaryFiles\":[]}",
                "{\"todoIds\":[],\"diaryFiles\":[null]}",
                body("Today", "[]", " "),
                body("Today", "[]", "a".repeat(2049))
        }) {
            perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(request), ownerId)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        assertThat(diaries.count()).isZero();
        assertThat(imageCount()).isZero();
    }

    @Test
    void cannotMoveTodoFromAnotherDiaryEvenForSameOwner() throws Exception {
        Todo todo = saveTodo();
        long id = createDiary(body("First", "[" + todo.getId() + "]", null));
        perform(post(PATH).contentType(MediaType.APPLICATION_JSON)
                .content(body("Second", "[" + todo.getId() + "]", null)), ownerId)
                .andExpect(status().isConflict());
        assertThat(diaries.count()).isEqualTo(1);
        assertThat(linkedDiary(todo.getId())).isEqualTo(id);
    }

    @Test
    void missingTodoDoesNotPartiallyCreateDiaryOrLinkValidTodo() throws Exception {
        Todo todo = saveTodo();
        perform(post(PATH).contentType(MediaType.APPLICATION_JSON)
                .content(body("Today", "[" + todo.getId() + "," + Long.MAX_VALUE + "]", IMAGE)), ownerId)
                .andExpect(status().isNotFound());

        assertThat(diaries.count()).isZero();
        assertThat(imageCount()).isZero();
        assertThat(linkedDiary(todo.getId())).isNull();
    }

    @Test
    void missingTodoDuringUpdatePreservesExistingContentImagesAndLinks() throws Exception {
        Todo todo = saveTodo();
        long id = createDiary(body("Before", "[" + todo.getId() + "]", IMAGE));

        perform(put(PATH + "/{id}", id).contentType(MediaType.APPLICATION_JSON)
                .content(body("After", "[" + Long.MAX_VALUE + "]", null)), ownerId)
                .andExpect(status().isNotFound());

        perform(get(PATH + "/{id}", id), ownerId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("Before"))
                .andExpect(jsonPath("$.todos[0].id").value(todo.getId()))
                .andExpect(jsonPath("$.diaryFiles[0].imageUrl").value(IMAGE));
        assertThat(linkedDiary(todo.getId())).isEqualTo(id);
        assertThat(imageCount()).isEqualTo(1);
    }

    private ResultActions perform(MockHttpServletRequestBuilder request, Long userId) throws Exception {
        return mvc.perform(request.with(jwt().jwt(token -> token.subject(userId.toString()))));
    }

    private long createDiary(String request) throws Exception {
        String response = perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(request), ownerId)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(response, "$.id")).longValue();
    }

    private Todo saveTodo() {
        return todos.save(new Todo(ownerId, "Walk", "Memo", LocalDate.of(2026, 10, 17), LocalTime.of(9, 0)));
    }

    private Long linkedDiary(Long todoId) {
        return jdbc.queryForObject("SELECT diary_id FROM todo WHERE id = ?", Long.class, todoId);
    }

    private long imageCount() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM diary_file", Long.class);
    }

    private static String body(String content, String todoIds, String imageUrl) {
        String files = imageUrl == null ? "[]" : "[{\"imageUrl\":\"" + imageUrl + "\"}]";
        return """
                {"content":"%s","todoIds":%s,"diaryFiles":%s}
                """.formatted(content, todoIds, files);
    }
}
