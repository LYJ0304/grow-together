package com.growtogether.diary;

import static org.assertj.core.api.Assertions.assertThat;

import com.growtogether.diary.domain.Diary;
import com.growtogether.diary.domain.DiaryFile;
import com.growtogether.todo.Todo;
import com.growtogether.todo.TodoRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
class DiaryRepositoryTest {
    private final Long userId = 1L;
    private final String imageUrl = "https://example.com/diary.jpg";

    @Autowired
    private DiaryRepository diaryRepository;

    @Autowired
    private TodoRepository todoRepository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void findByIdAndUserId_본인일기이면_조회성공() {
        Diary saved = diaryRepository.saveAndFlush(new Diary(userId, "오늘의 일기"));
        entityManager.clear();

        var result = diaryRepository.findByIdAndUserId(saved.getId(), userId);

        assertThat(result).isPresent();
        assertThat(result.orElseThrow().getContent()).isEqualTo("오늘의 일기");
        assertThat(result.orElseThrow().getUserId()).isEqualTo(userId);
    }

    @Test
    void findByIdAndUserId_다른사용자이거나없는일기이면_빈값반환() {
        Diary saved = diaryRepository.saveAndFlush(new Diary(userId, "비공개 일기"));
        entityManager.clear();

        assertThat(diaryRepository.findByIdAndUserId(saved.getId(), 2L)).isEmpty();
        assertThat(diaryRepository.findByIdAndUserId(Long.MAX_VALUE, userId)).isEmpty();
    }

    @Test
    void save_일기와이미지및할일연결_저장후조회() {
        Todo todo = saveTodo();
        Diary diary = new Diary(userId, "오늘의 일기");
        diary.addDiaryFile(new DiaryFile(imageUrl));
        diary.replaceTodos(List.of(todo));

        Diary saved = diaryRepository.saveAndFlush(diary);
        entityManager.clear();

        Diary found = diaryRepository.findByIdAndUserId(saved.getId(), userId).orElseThrow();
        assertThat(found.getDiaryFiles()).hasSize(1);
        DiaryFile image = found.getDiaryFiles().getFirst();
        assertThat(image.getId()).isNotNull();
        assertThat(image.getImageUrl()).isEqualTo(imageUrl);
        assertThat(image.getDiary()).isSameAs(found);
        assertThat(found.getTodos()).extracting(Todo::getId).containsExactly(todo.getId());
        assertThat(found.getTodos().getFirst().getDiary()).isSameAs(found);
    }

    @Test
    void update_이미지교체시_기존이미지삭제() {
        Diary diary = new Diary(userId, "기존 일기");
        DiaryFile previous = new DiaryFile(imageUrl);
        diary.addDiaryFile(previous);
        diaryRepository.saveAndFlush(diary);
        Long previousImageId = previous.getId();
        entityManager.clear();
        Diary found = diaryRepository.findByIdAndUserId(diary.getId(), userId).orElseThrow();
        found.updateContent("수정한 일기");
        found.getDiaryFiles().clear();
        String newImageUrl = "https://example.com/updated.jpg";
        found.addDiaryFile(new DiaryFile(newImageUrl));

        diaryRepository.flush();
        entityManager.clear();

        Diary updated = diaryRepository.findByIdAndUserId(diary.getId(), userId).orElseThrow();
        assertThat(updated.getContent()).isEqualTo("수정한 일기");
        assertThat(updated.getDiaryFiles()).extracting(DiaryFile::getImageUrl).containsExactly(newImageUrl);
        assertThat(entityManager.find(DiaryFile.class, previousImageId)).isNull();
    }

    @Test
    void update_빈목록이면_이미지삭제하고할일연결만해제() {
        Todo todo = saveTodo();
        Diary diary = new Diary(userId, "오늘의 일기");
        DiaryFile image = new DiaryFile(imageUrl);
        diary.addDiaryFile(image);
        diary.replaceTodos(List.of(todo));
        diaryRepository.saveAndFlush(diary);
        Long imageId = image.getId();
        entityManager.clear();
        Diary found = diaryRepository.findByIdAndUserId(diary.getId(), userId).orElseThrow();

        found.replaceTodos(List.of());
        found.getDiaryFiles().clear();
        diaryRepository.flush();
        entityManager.clear();

        Diary updated = diaryRepository.findByIdAndUserId(diary.getId(), userId).orElseThrow();
        assertThat(updated.getTodos()).isEmpty();
        assertThat(updated.getDiaryFiles()).isEmpty();
        assertThat(entityManager.find(DiaryFile.class, imageId)).isNull();
        Todo preserved = todoRepository.findById(todo.getId()).orElseThrow();
        assertThat(preserved.getDiary()).isNull();
        assertThat(preserved.getUserId()).isEqualTo(userId);
    }

    @Test
    void delete_할일연결해제후삭제하면_이미지는삭제하고할일은보존() {
        Todo todo = saveTodo();
        Diary diary = new Diary(userId, "오늘의 일기");
        DiaryFile image = new DiaryFile(imageUrl);
        diary.addDiaryFile(image);
        diary.replaceTodos(List.of(todo));
        diaryRepository.saveAndFlush(diary);
        Long imageId = image.getId();
        entityManager.clear();
        Diary found = diaryRepository.findByIdAndUserId(diary.getId(), userId).orElseThrow();

        found.replaceTodos(List.of());
        diaryRepository.delete(found);
        diaryRepository.flush();
        entityManager.clear();

        assertThat(diaryRepository.findById(diary.getId())).isEmpty();
        assertThat(entityManager.find(DiaryFile.class, imageId)).isNull();
        Todo preserved = todoRepository.findById(todo.getId()).orElseThrow();
        assertThat(preserved.getDiary()).isNull();
        assertThat(preserved.getUserId()).isEqualTo(userId);
    }

    private Todo saveTodo() {
        return todoRepository.saveAndFlush(new Todo(userId, "산책", "메모",
                LocalDate.of(2026, 10, 25), LocalTime.of(9, 0)));
    }
}
