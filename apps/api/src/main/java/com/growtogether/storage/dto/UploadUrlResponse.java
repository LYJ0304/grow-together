package com.growtogether.storage.dto;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
public record UploadUrlResponse(UUID id, String uploadUrl, Instant expiresAt, Map<String, String> headers) { }
