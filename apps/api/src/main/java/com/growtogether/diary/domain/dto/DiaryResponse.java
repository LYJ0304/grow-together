package com.growtogether.diary.domain.dto;

import com.growtogether.diary.domain.Diary;
import com.growtogether.diary.domain.DiaryFile;
import java.util.UUID;
import java.util.function.Function;
import com.growtogether.todo.dto.TodoResponse;
import java.util.List;
import java.time.LocalDate;

public record DiaryResponse(
    Long id,
    LocalDate diaryDate,
    String content,
    List<TodoResponse> todos,
    List<DiaryFileResponse> diaryFiles
) {
    public static DiaryResponse from(Diary diary, Function<DiaryFile, String> imageUrl) {
        return new DiaryResponse(
            diary.getId(),
            diary.getDiaryDate(),
            diary.getContent(),
                diary.getTodos().stream().map(TodoResponse::from).toList(),
                diary.getDiaryFiles().stream()
                        .map(file -> new DiaryFileResponse(file.getId(), imageUrl.apply(file), file.getStoredFileId())).toList());
    }

    public record DiaryFileResponse(Long id, String imageUrl, @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) UUID fileId) {
        public DiaryFileResponse(Long id, String imageUrl) {
            this(id, imageUrl, null);
        }
    }
}
