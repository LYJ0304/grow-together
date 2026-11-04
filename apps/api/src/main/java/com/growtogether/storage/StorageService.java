package com.growtogether.storage;

public interface StorageService {
    String createUploadUrl(String objectKey, String contentType);
    String createDownloadUrl(String objectKey);
    StorageObjectMetadata getMetadata(String objectKey);
    void delete(String objectKey);
}
