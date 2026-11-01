package com.growtogether.storage.infrastructure;
import java.time.Instant;
import java.util.Map;
public interface StorageService {
    record SignedUrl(String url, Instant expiresAt, Map<String, String> headers) { }
    record ObjectMetadata(long size, String contentType) { }
    SignedUrl generatePresignedUploadUrl(String objectKey, String contentType, long size);
    SignedUrl generatePresignedDownloadUrl(String objectKey);
    ObjectMetadata getObjectMetadata(String objectKey);
    void deleteObject(String objectKey);
}
