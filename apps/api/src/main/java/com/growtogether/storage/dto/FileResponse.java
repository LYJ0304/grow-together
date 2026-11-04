package com.growtogether.storage.dto;

import com.growtogether.storage.FileStatus;
import java.time.Instant;
import java.util.UUID;

public record FileResponse(UUID id, String filename, String contentType,
        Long fileSize, FileStatus status, Instant createdAt) {
}
