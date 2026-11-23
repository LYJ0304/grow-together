package com.growtogether.diary;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import com.growtogether.diary.domain.Diary;
import com.growtogether.diary.domain.DiaryFile;
import com.growtogether.diary.domain.dto.DiaryRequest;
import com.growtogether.diary.domain.dto.DiaryResponse;
import com.growtogether.todo.Todo;
import com.growtogether.todo.TodoRepository;
import java.util.List;
import java.time.LocalDate;
import java.time.YearMonth;
import com.growtogether.diary.domain.dto.DiaryCreateRequest;
import com.growtogether.diary.domain.dto.DiarySummary;
import org.springframework.dao.DataIntegrityViolationException;
import org.hibernate.exception.ConstraintViolationException;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DiaryService {
    private final DiaryRepository diaryRepository;
    private final TodoRepository todoRepository;
    private final com.growtogether.storage.FileService fileService;

    @Transactional
    public DiaryResponse create(Long userId, DiaryCreateRequest request) {
        List<Todo> todos = findTodos(userId, null, request.todoIds());
        Diary diary = new Diary(userId, request.diaryDate(), request.content());
        replaceFields(diary, request.fields(), todos);
        try {
            return response(diaryRepository.saveAndFlush(diary));
        } catch (DataIntegrityViolationException exception) {
            // Only this named constraint means a same-day conflict; do not mask other failures.
            for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
                if (cause instanceof ConstraintViolationException violation
                        && violation.getConstraintName() != null
                        && violation.getConstraintName().toLowerCase(java.util.Locale.ROOT).contains("uq_diary_user_date")) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Diary already exists for this date");
                }
            }
            throw exception;
        }
    }

    public List<DiarySummary> getMonth(Long userId, YearMonth month) {
        return diaryRepository.findByUserIdAndDiaryDateGreaterThanEqualAndDiaryDateLessThanOrderByDiaryDateAsc(
                userId, month.atDay(1), month.plusMonths(1).atDay(1)).stream()
                .map(diary -> new DiarySummary(diary.getId(), diary.getDiaryDate())).toList();
    }

    public DiaryResponse getByDate(Long userId, LocalDate date) {
        return response(diaryRepository.findByUserIdAndDiaryDate(userId, date)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Diary not found")));
    }

    public DiaryResponse getDiary(Long userId, Long id) {
        return response(findDiary(userId, id));
    }

    @Transactional
    public DiaryResponse updateDiary(Long userId, Long id, DiaryRequest request) {
        Diary diary = findDiary(userId, id);
        List<Todo> todos = findTodos(userId, id, request.todoIds());
        replaceFields(diary, request, todos);
        diaryRepository.flush();
        return response(diary);
    }

    @Transactional
    public void deleteDiary(Long userId, Long id) {
        Diary diary = findDiary(userId, id);
        diary.replaceTodos(List.of());
        diaryRepository.delete(diary);
    }

    private Diary findDiary(Long userId, Long id) {
        return diaryRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Diary not found"));
    }

    private List<Todo> findTodos(Long userId, Long diaryId, List<Long> ids) {
        return ids.stream().distinct().sorted().map(id -> {
            Todo todo = todoRepository.findForDiaryByIdAndUserId(id, userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Todo not found"));
            Diary linked = todo.getDiary();
            if (linked != null) {
                if (!linked.getUserId().equals(userId)) {
                    throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Todo not found");
                }
                if (!linked.getId().equals(diaryId)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Todo already linked to another diary");
                }
            }
            return todo;
        }).toList();
    }

    private DiaryResponse response(Diary diary) {
        return DiaryResponse.from(diary, file -> file.getStoredFileId() == null
                ? file.getImageUrl() : fileService.diaryImageUrl(diary.getUserId(), file.getStoredFileId()));
    }

    private void replaceFields(Diary diary, DiaryRequest request, List<Todo> todos) {
        diary.updateContent(request.content());
        diary.replaceTodos(todos);
        diary.getDiaryFiles().clear();
        request.diaryFiles().forEach(file -> {
            if (file.fileId() == null) {
                diary.addDiaryFile(new DiaryFile(file.imageUrl()));
            } else {
                fileService.diaryImageUrl(diary.getUserId(), file.fileId());
                diary.addDiaryFile(new DiaryFile(file.fileId()));
            }
        });
    }
}
