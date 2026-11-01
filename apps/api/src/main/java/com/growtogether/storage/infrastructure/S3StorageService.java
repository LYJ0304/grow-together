package com.growtogether.storage.infrastructure;

import com.growtogether.storage.config.StorageProperties;
import java.util.*;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.*;

@RequiredArgsConstructor
public class S3StorageService implements StorageService {
    private final S3Client client;
    private final S3Presigner presigner;
    private final StorageProperties properties;

    public SignedUrl generatePresignedUploadUrl(String key, String type, long size) {
        return execute(() -> {
            var request = PutObjectRequest.builder().bucket(properties.bucket()).key(key)
                    .contentType(type).contentLength(size).ifNoneMatch("*").build();
            var signed = presigner.presignPutObject(PutObjectPresignRequest.builder()
                    .signatureDuration(properties.urlTtl()).putObjectRequest(request).build());
            return new SignedUrl(signed.url().toString(), signed.expiration(),
                    Map.of("Content-Type", type, "Content-Length", Long.toString(size), "If-None-Match", "*"));
        });
    }
    public SignedUrl generatePresignedDownloadUrl(String key) {
        return execute(() -> {
            var signed = presigner.presignGetObject(GetObjectPresignRequest.builder().signatureDuration(properties.urlTtl())
                    .getObjectRequest(GetObjectRequest.builder().bucket(properties.bucket()).key(key).build()).build());
            return new SignedUrl(signed.url().toString(), signed.expiration(), Map.of());
        });
    }
    public ObjectMetadata getObjectMetadata(String key) {
        return execute(() -> {
            try {
                var response = client.headObject(HeadObjectRequest.builder().bucket(properties.bucket()).key(key).build());
                return new ObjectMetadata(response.contentLength(), response.contentType());
            } catch (S3Exception exception) {
                if (exception.statusCode() == 404) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Uploaded object not found");
                }
                throw exception;
            }
        });
    }
    public void deleteObject(String key) {
        execute(() -> {
            client.deleteObject(DeleteObjectRequest.builder().bucket(properties.bucket()).key(key).build());
            return null;
        });
    }
    private <T> T execute(Supplier<T> operation) {
        try { return operation.get(); }
        catch (SdkException exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "File storage is temporarily unavailable");
        }
    }
}
