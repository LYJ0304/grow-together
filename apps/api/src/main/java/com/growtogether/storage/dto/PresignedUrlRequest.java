package com.growtogether.storage.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record PresignedUrlRequest(
        @NotBlank @Size(max = 255) String filename,
        @NotBlank @Size(max = 100) String contentType,
        @NotNull @Positive Long fileSize
) {
}
