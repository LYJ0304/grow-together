package com.growtogether.storage;
import com.growtogether.storage.dto.*;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/v1/files")
@RequiredArgsConstructor
public class FileController {
    private final FileService fileService;
    @PostMapping("/presigned-url")
    public ResponseEntity<UploadUrlResponse> generateUploadUrl(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UploadUrlRequest request) {
        return ResponseEntity.status(201).body(fileService.initiateUpload(Long.valueOf(jwt.getSubject()), request));
    }
    @PostMapping("/{id}/complete")
    public ResponseEntity<Void> completeUpload(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        fileService.completeUpload(Long.valueOf(jwt.getSubject()), id);
        return ResponseEntity.ok().build();
    }
    @GetMapping("/{id}")
    public ResponseEntity<FileMetadataResponse> getFileMetadata(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ResponseEntity.ok(fileService.getFileMetadata(Long.valueOf(jwt.getSubject()), id));
    }
    @GetMapping("/{id}/download-url")
    public ResponseEntity<DownloadUrlResponse> generateDownloadUrl(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ResponseEntity.ok(fileService.generateDownloadUrl(Long.valueOf(jwt.getSubject()), id));
    }
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFile(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        fileService.deleteFile(Long.valueOf(jwt.getSubject()), id);
        return ResponseEntity.noContent().build();
    }
}
