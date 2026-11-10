package com.growtogether.diary.domain.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

public record DiaryCreateRequest(
    @NotNull LocalDate diaryDate,
    @Size(max = 1000) String content,
    @NotNull List<@NotNull @Positive Long> todoIds,
    @NotNull List<@NotNull @Valid DiaryFileRequest> diaryFiles
) {
    public DiaryRequest fields() { return new DiaryRequest(content, todoIds, diaryFiles); }
}
