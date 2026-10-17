package com.growtogether.diary.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DiaryFileRequest(
    @NotBlank
    @Size(max = 2048)
    String imageUrl
) {

}
