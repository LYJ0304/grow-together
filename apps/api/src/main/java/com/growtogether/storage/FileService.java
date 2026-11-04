package com.growtogether.storage;

import com.growtogether.common.config.S3Properties;
import com.growtogether.storage.dto.FileResponse;
import com.growtogether.storage.dto.PresignedUrlRequest;
import com.growtogether.storage.dto.PresignedUrlResponse;
import java.time.Clock;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Service
@RequiredArgsConstructor
public class FileService {
    private final StorageService storageService;
    private final StoredFileRepository files;
    private final S3Properties properties;
    private final Clock clock;

    @Transactional
    public PresignedUrlResponse issueUploadUrl(Long userId, PresignedUrlRequest request) {
        if (request.fileSize() > properties.maxFileSize().toBytes()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File exceeds the maximum size");
        }
        String objectKey = "files/" + userId + "/" + UUID.randomUUID();
        StoredFile file = files.save(new StoredFile(userId, objectKey,
                request.filename(), request.contentType(), request.fileSize()));
        var expiresAt = clock.instant().plus(properties.presignedUrlExpiration());
        String uploadUrl = storageService.createUploadUrl(objectKey, request.contentType());
        return new PresignedUrlResponse(file.getId(), uploadUrl, objectKey, expiresAt);
    }

    @Transactional
    public FileResponse completeUpload(Long userId, UUID fileId) {
        StoredFile file = files.findByIdAndOwnerId(fileId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found"));
        if (file.getStatus() != FileStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "File is no longer pending");
        }
        StorageObjectMetadata metadata;
        try {
            metadata = storageService.getMetadata(file.getObjectKey());
        } catch (S3Exception exception) {
            if (exception.statusCode() == 404) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File has not been uploaded", exception);
            }
            throw exception;
        }
        if (metadata.contentLength() != file.getFileSize()
                || metadata.contentLength() > properties.maxFileSize().toBytes()
                || !file.getContentType().equals(metadata.contentType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Uploaded file metadata does not match");
        }
        file.complete(metadata.contentLength());
        return new FileResponse(file.getId(), file.getOriginalFilename(), file.getContentType(),
                file.getFileSize(), file.getStatus(), file.getCreatedAt());
    }
}
