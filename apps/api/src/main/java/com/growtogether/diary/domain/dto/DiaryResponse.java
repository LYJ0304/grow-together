package com.growtogether.diary.domain.dto;

import com.growtogether.diary.domain.Diary;
import com.growtogether.todo.dto.TodoResponse;
import java.util.List;

public record DiaryResponse(
    Long id,
    String content,
    List<TodoResponse> todos,
    List<DiaryFileResponse> diaryFiles
) {
    public static DiaryResponse from(Diary diary) {
        return new DiaryResponse(
            diary.getId(),
            diary.getContent(),
                diary.getTodos().stream().map(TodoResponse::from).toList(),
                diary.getDiaryFiles().stream()
                        .map(file -> new DiaryFileResponse(file.getId(), file.getImageUrl())).toList());
    }

    public record DiaryFileResponse(Long id, String imageUrl) {}
}
