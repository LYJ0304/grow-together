package com.growtogether.storage.dto;
import java.time.Instant;
import java.util.UUID;
import com.growtogether.storage.domain.*;
public record FileMetadataResponse(UUID id, String originalName, String contentType, long size,
        FileStatus status, Instant createdAt, Instant uploadedAt) {
    public static FileMetadataResponse from(StoredFile file) {
        return new FileMetadataResponse(file.getId(), file.getOriginalName(), file.getContentType(),
                file.getSize(), file.getStatus(), file.getCreatedAt(), file.getUploadedAt());
    }
}
