package com.growtogether.storage.dto;
import jakarta.validation.constraints.*;
public record UploadUrlRequest(@NotBlank @Size(max = 255) String originalName,
        @NotBlank String contentType, @NotNull @Positive @Max(5242880) Long size) { }
