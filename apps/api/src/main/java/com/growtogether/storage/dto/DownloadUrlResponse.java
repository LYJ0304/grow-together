package com.growtogether.storage.dto;
import java.time.Instant;
public record DownloadUrlResponse(String downloadUrl, Instant expiresAt) { }
