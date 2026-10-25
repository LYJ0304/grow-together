package com.growtogether.diary;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;

import com.growtogether.diary.domain.Diary;
import com.growtogether.diary.domain.DiaryFile;
import com.growtogether.diary.domain.dto.DiaryFileRequest;
import com.growtogether.diary.domain.dto.DiaryRequest;
import com.growtogether.todo.Todo;
import com.growtogether.todo.TodoRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class DiaryServiceTest {
    private final Long userId = 1L;
    private final Long diaryId = 10L;
    private final String imageUrl = "https://example.com/diary.jpg";

    @Mock
    private DiaryRepository diaryRepository;

    @Mock
    private TodoRepository todoRepository;

    @InjectMocks
    private DiaryService diaryService;

    @Test
    void create_할일과이미지가있으면_연결해서저장() {
        Todo todo = todo(20L);
        var request = new DiaryRequest("오늘의 일기", List.of(20L, 20L),
                List.of(new DiaryFileRequest(imageUrl)));
        given(todoRepository.findForDiaryByIdAndUserId(20L, userId)).willReturn(Optional.of(todo));
        given(diaryRepository.saveAndFlush(any(Diary.class))).willAnswer(invocation -> {
            Diary diary = invocation.getArgument(0);
            ReflectionTestUtils.setField(diary, "id", diaryId);
            return diary;
        });

        var response = diaryService.create(userId, request);

        assertThat(response.id()).isEqualTo(diaryId);
        assertThat(response.content()).isEqualTo(request.content());
        assertThat(response.todos()).hasSize(1);
        assertThat(response.todos().getFirst().id()).isEqualTo(todo.getId());
        assertThat(response.diaryFiles()).hasSize(1);
        assertThat(response.diaryFiles().getFirst().imageUrl()).isEqualTo(imageUrl);
        var saved = ArgumentCaptor.forClass(Diary.class);
        then(diaryRepository).should().saveAndFlush(saved.capture());
        assertThat(saved.getValue().getUserId()).isEqualTo(userId);
        assertThat(saved.getValue().getTodos()).containsExactly(todo);
        assertThat(todo.getDiary()).isSameAs(saved.getValue());
        assertThat(saved.getValue().getDiaryFiles().getFirst().getDiary()).isSameAs(saved.getValue());
        then(todoRepository).should().findForDiaryByIdAndUserId(20L, userId);
    }

    @Test
    void create_할일과이미지가없으면_빈목록으로생성() {
        var request = new DiaryRequest("오늘의 일기", List.of(), List.of());
        given(diaryRepository.saveAndFlush(any(Diary.class)))
                .willAnswer(invocation -> invocation.getArgument(0));

        var response = diaryService.create(userId, request);

        assertThat(response.content()).isEqualTo(request.content());
        assertThat(response.todos()).isEmpty();
        assertThat(response.diaryFiles()).isEmpty();
        then(todoRepository).shouldHaveNoInteractions();
        then(diaryRepository).should().saveAndFlush(any(Diary.class));
    }

    @Test
    void get_본인일기이면_응답반환() {
        Diary diary = diary(userId, diaryId);
        diary.addDiaryFile(new DiaryFile(imageUrl));
        given(diaryRepository.findByIdAndUserId(diaryId, userId)).willReturn(Optional.of(diary));

        var response = diaryService.getDiary(userId, diaryId);

        assertThat(response.id()).isEqualTo(diaryId);
        assertThat(response.content()).isEqualTo(diary.getContent());
        assertThat(response.diaryFiles().getFirst().imageUrl()).isEqualTo(imageUrl);
        then(diaryRepository).should().findByIdAndUserId(diaryId, userId);
    }

    @Test
    void get_본인일기를찾지못하면_404반환() {
        given(diaryRepository.findByIdAndUserId(diaryId, userId)).willReturn(Optional.empty());

        assertThatThrownBy(() -> diaryService.getDiary(userId, diaryId))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));

        then(diaryRepository).should().findByIdAndUserId(diaryId, userId);
    }

    @Test
    void update_새내용과목록으로_기존연결교체() {
        Diary diary = diary(userId, diaryId);
        Todo previous = todo(20L);
        Todo replacement = todo(30L);
        diary.replaceTodos(List.of(previous));
        diary.addDiaryFile(new DiaryFile(imageUrl));
        String newImageUrl = "https://example.com/updated.jpg";
        var request = new DiaryRequest("수정한 일기", List.of(30L),
                List.of(new DiaryFileRequest(newImageUrl)));
        given(diaryRepository.findByIdAndUserId(diaryId, userId)).willReturn(Optional.of(diary));
        given(todoRepository.findForDiaryByIdAndUserId(30L, userId)).willReturn(Optional.of(replacement));

        var response = diaryService.updateDiary(userId, diaryId, request);

        assertThat(response.id()).isEqualTo(diaryId);
        assertThat(response.content()).isEqualTo(request.content());
        assertThat(response.todos()).hasSize(1);
        assertThat(response.todos().getFirst().id()).isEqualTo(replacement.getId());
        assertThat(response.diaryFiles()).hasSize(1);
        assertThat(response.diaryFiles().getFirst().imageUrl()).isEqualTo(newImageUrl);
        assertThat(previous.getDiary()).isNull();
        assertThat(replacement.getDiary()).isSameAs(diary);
        then(diaryRepository).should().flush();
    }

    @Test
    void update_빈목록이면_할일연결과이미지제거() {
        Diary diary = diary(userId, diaryId);
        Todo todo = todo(20L);
        diary.replaceTodos(List.of(todo));
        diary.addDiaryFile(new DiaryFile(imageUrl));
        var request = new DiaryRequest("수정한 일기", List.of(), List.of());
        given(diaryRepository.findByIdAndUserId(diaryId, userId)).willReturn(Optional.of(diary));

        var response = diaryService.updateDiary(userId, diaryId, request);

        assertThat(response.todos()).isEmpty();
        assertThat(response.diaryFiles()).isEmpty();
        assertThat(todo.getDiary()).isNull();
        assertThat(todo.getUserId()).isEqualTo(userId);
        then(todoRepository).shouldHaveNoInteractions();
        then(diaryRepository).should().flush();
    }

    @Test
    void update_같은일기에연결된할일이면_연결유지() {
        Diary diary = diary(userId, diaryId);
        Todo todo = todo(20L);
        diary.replaceTodos(List.of(todo));
        var request = new DiaryRequest("수정한 일기", List.of(20L), List.of());
        given(diaryRepository.findByIdAndUserId(diaryId, userId)).willReturn(Optional.of(diary));
        given(todoRepository.findForDiaryByIdAndUserId(20L, userId)).willReturn(Optional.of(todo));

        var response = diaryService.updateDiary(userId, diaryId, request);

        assertThat(response.todos()).hasSize(1);
        assertThat(diary.getTodos()).containsExactly(todo);
        assertThat(todo.getDiary()).isSameAs(diary);
        then(diaryRepository).should().flush();
    }

    @Test
    void update_본인일기를찾지못하면_변경하지않고404반환() {
        var request = new DiaryRequest("수정한 일기", List.of(), List.of());
        given(diaryRepository.findByIdAndUserId(diaryId, userId)).willReturn(Optional.empty());

        assertThatThrownBy(() -> diaryService.updateDiary(userId, diaryId, request))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));

        then(diaryRepository).should(never()).flush();
        then(todoRepository).shouldHaveNoInteractions();
    }

    @Test
    void delete_할일연결을해제한뒤_일기삭제() {
        Diary diary = diary(userId, diaryId);
        Todo todo = todo(20L);
        diary.replaceTodos(List.of(todo));
        given(diaryRepository.findByIdAndUserId(diaryId, userId)).willReturn(Optional.of(diary));

        diaryService.deleteDiary(userId, diaryId);

        assertThat(diary.getTodos()).isEmpty();
        assertThat(todo.getDiary()).isNull();
        assertThat(todo.getUserId()).isEqualTo(userId);
        then(diaryRepository).should().delete(diary);
        then(todoRepository).shouldHaveNoInteractions();
    }

    @Test
    void delete_본인일기를찾지못하면_삭제하지않고404반환() {
        given(diaryRepository.findByIdAndUserId(diaryId, userId)).willReturn(Optional.empty());

        assertThatThrownBy(() -> diaryService.deleteDiary(userId, diaryId))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));

        then(diaryRepository).should(never()).delete(any(Diary.class));
    }

    @Test
    void create_본인할일을찾지못하면_저장하지않고404반환() {
        var request = new DiaryRequest("오늘의 일기", List.of(20L), List.of());
        given(todoRepository.findForDiaryByIdAndUserId(20L, userId)).willReturn(Optional.empty());

        assertThatThrownBy(() -> diaryService.create(userId, request))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));

        then(diaryRepository).shouldHaveNoInteractions();
    }

    @Test
    void create_다른본인일기에연결된할일이면_409반환() {
        Todo todo = todo(20L);
        Diary linked = diary(userId, 99L);
        linked.replaceTodos(List.of(todo));
        var request = new DiaryRequest("오늘의 일기", List.of(20L), List.of());
        given(todoRepository.findForDiaryByIdAndUserId(20L, userId)).willReturn(Optional.of(todo));

        assertThatThrownBy(() -> diaryService.create(userId, request))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));

        assertThat(todo.getDiary()).isSameAs(linked);
        then(diaryRepository).shouldHaveNoInteractions();
    }

    @Test
    void create_다른사용자일기에연결된할일이면_404반환() {
        Todo todo = todo(20L);
        Diary linked = diary(2L, 99L);
        linked.replaceTodos(List.of(todo));
        var request = new DiaryRequest("오늘의 일기", List.of(20L), List.of());
        given(todoRepository.findForDiaryByIdAndUserId(20L, userId)).willReturn(Optional.of(todo));

        assertThatThrownBy(() -> diaryService.create(userId, request))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));

        assertThat(todo.getDiary()).isSameAs(linked);
        then(diaryRepository).shouldHaveNoInteractions();
    }

    @Test
    void update_할일을찾지못하면_기존내용과연결유지() {
        Diary diary = diary(userId, diaryId);
        Todo todo = todo(20L);
        diary.replaceTodos(List.of(todo));
        diary.addDiaryFile(new DiaryFile(imageUrl));
        var request = new DiaryRequest("수정한 일기", List.of(99L), List.of());
        given(diaryRepository.findByIdAndUserId(diaryId, userId)).willReturn(Optional.of(diary));
        given(todoRepository.findForDiaryByIdAndUserId(99L, userId)).willReturn(Optional.empty());

        assertThatThrownBy(() -> diaryService.updateDiary(userId, diaryId, request))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        exception -> assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));

        assertThat(diary.getContent()).isEqualTo("기존 일기");
        assertThat(diary.getTodos()).containsExactly(todo);
        assertThat(todo.getDiary()).isSameAs(diary);
        assertThat(diary.getDiaryFiles()).extracting(DiaryFile::getImageUrl).containsExactly(imageUrl);
        then(diaryRepository).should(never()).flush();
    }

    private Diary diary(Long ownerId, Long id) {
        Diary diary = new Diary(ownerId, "기존 일기");
        ReflectionTestUtils.setField(diary, "id", id);
        return diary;
    }

    private Todo todo(Long id) {
        Todo todo = new Todo(userId, "산책", "메모", LocalDate.of(2026, 10, 25), LocalTime.of(9, 0));
        ReflectionTestUtils.setField(todo, "id", id);
        return todo;
    }
}
