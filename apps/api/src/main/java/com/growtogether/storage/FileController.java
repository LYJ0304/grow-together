package com.growtogether.storage;

import com.growtogether.storage.dto.FileResponse;
import com.growtogether.storage.dto.PresignedUrlRequest;
import com.growtogether.storage.dto.PresignedUrlResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {
    private final FileService fileService;

    @PostMapping("/presigned-url")
    public ResponseEntity<PresignedUrlResponse> issueUploadUrl(
            @Valid @RequestBody PresignedUrlRequest request, @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(fileService.issueUploadUrl(Long.valueOf(jwt.getSubject()), request));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<FileResponse> completeUpload(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(fileService.completeUpload(Long.valueOf(jwt.getSubject()), id));
    }
}
