package com.growtogether.diary.domain.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;

public record DiaryRequest(
    @Size(max = 1000)
    String content,

    @NotNull
    List<@NotNull @Positive Long> todoIds,

    @NotNull
    List<@NotNull @Valid DiaryFileRequest> diaryFiles

) {

}
