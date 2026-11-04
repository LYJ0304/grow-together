package com.growtogether.storage.dto;

import java.time.Instant;
import java.util.UUID;

public record PresignedUrlResponse(UUID fileId, String uploadUrl, String objectKey, Instant expiresAt) {
}
