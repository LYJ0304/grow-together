package com.growtogether.storage;

import com.growtogether.storage.domain.*;
import com.growtogether.storage.dto.*;
import com.growtogether.storage.infrastructure.StorageService;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class FileService {
    private static final Map<String, Set<String>> EXTENSIONS = Map.of(
            "image/jpeg", Set.of("jpg", "jpeg"), "image/png", Set.of("png"), "image/webp", Set.of("webp"));
    private final FileRepository fileRepository;
    private final StorageService storage;

    @Transactional
    public UploadUrlResponse initiateUpload(Long userId, UploadUrlRequest request) {
        validate(request);
        UUID id = UUID.randomUUID();
        Instant now = Instant.now();
        var signed = storage.generatePresignedUploadUrl("files/" + id, request.contentType(), request.size());
        fileRepository.save(new StoredFile(id, userId, request.originalName(), request.contentType(),
                request.size(), now, signed.expiresAt()));
        return new UploadUrlResponse(id, signed.url(), signed.expiresAt(), signed.headers());
    }

    // Persist FAILED/DELETING even when reporting a storage or validation error to the caller.
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public void completeUpload(Long userId, UUID id) {
        StoredFile file = ownedForUpdate(userId, id);
        if (file.getStatus() == FileStatus.READY) return;
        if (file.getStatus() != FileStatus.PENDING || !file.getPendingExpiresAt().isAfter(Instant.now())) {
            throw conflict("File is not pending or upload has expired");
        }
        var metadata = storage.getObjectMetadata(file.getObjectKey());
        if (metadata.size() != file.getSize() || !file.getContentType().equals(metadata.contentType())) {
            file.markFailed();
            throw conflict("Uploaded object does not match declared metadata");
        }
        file.markReady(Instant.now());
    }

    @Transactional(readOnly = true)
    public FileMetadataResponse getFileMetadata(Long userId, UUID id) {
        return FileMetadataResponse.from(owned(userId, id));
    }

    @Transactional(readOnly = true)
    public DownloadUrlResponse generateDownloadUrl(Long userId, UUID id) {
        StoredFile file = owned(userId, id);
        if (file.getStatus() != FileStatus.READY) throw conflict("File is not ready");
        var signed = storage.generatePresignedDownloadUrl(file.getObjectKey());
        return new DownloadUrlResponse(signed.url(), signed.expiresAt());
    }

    @Transactional(noRollbackFor = ResponseStatusException.class)
    public void deleteFile(Long userId, UUID id) {
        StoredFile file = ownedForUpdate(userId, id);
        file.markDeleting();
        storage.deleteObject(file.getObjectKey());
        // Keep the tombstone: an issued PUT URL can recreate an object after deletion.
        if (!file.getUploadExpiresAt().isAfter(Instant.now())) fileRepository.delete(file);
    }

    @Transactional
    public void cleanup(UUID id) {
        fileRepository.findForUpdate(id).ifPresent(file -> {
            Instant now = Instant.now();
            boolean expired = file.getStatus() == FileStatus.PENDING && file.getPendingExpiresAt().isBefore(now);
            boolean discarded = (file.getStatus() == FileStatus.FAILED || file.getStatus() == FileStatus.DELETING)
                    && file.getUploadExpiresAt().isBefore(now);
            if (expired || discarded) {
                storage.deleteObject(file.getObjectKey());
                fileRepository.delete(file);
            }
        });
    }

    private StoredFile owned(Long userId, UUID id) {
        return fileRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found"));
    }
    private StoredFile ownedForUpdate(Long userId, UUID id) {
        return fileRepository.findOwnedForUpdate(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found"));
    }
    private ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }
    private void validate(UploadUrlRequest request) {
        String name = request.originalName();
        Set<String> extensions = EXTENSIONS.get(request.contentType());
        if (name == null || name.isBlank() || name.length() > 255 || name.contains("/") || name.contains("\\")
                || name.chars().anyMatch(Character::isISOControl) || extensions == null
                || !extensions.contains(name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT))
                || name.lastIndexOf('.') <= 0 || request.size() == null || request.size() <= 0 || request.size() > 5242880) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported file name, type or size");
        }
    }
}
