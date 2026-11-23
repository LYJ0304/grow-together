package com.growtogether.diary.domain.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record DiaryFileRequest(@Size(max = 2048) String imageUrl, UUID fileId) {
    public DiaryFileRequest(String imageUrl) {
        this(imageUrl, null);
    }

    @JsonIgnore
    @AssertTrue(message = "Provide either an image URL or an uploaded file ID")
    public boolean isValidSource() {
        return fileId == null ? imageUrl != null && !imageUrl.isBlank() : imageUrl == null;
    }
}
