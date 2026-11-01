package com.growtogether.storage.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;
@Entity
@Table(name = "stored_file")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StoredFile {
    @Id
    private UUID id;
    @Column(nullable = false)
    private Long userId;
    @Column(nullable = false, unique = true, length = 512)
    private String objectKey;
    @Column(nullable = false)
    private String originalName;
    @Column(nullable = false, length = 100)
    private String contentType;
    @Column(nullable = false)
    private long size;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FileStatus status;
    @Column(nullable = false)
    private Instant createdAt;
    @Column(nullable = false)
    private Instant uploadExpiresAt;
    @Column(nullable = false)
    private Instant pendingExpiresAt;
    private Instant uploadedAt;
    public StoredFile(UUID id, Long userId, String originalName, String contentType, long size,
            Instant now, Instant uploadExpiresAt) {
        this.id = id;
        this.userId = userId;
        this.objectKey = "files/" + id;
        this.originalName = originalName;
        this.contentType = contentType;
        this.size = size;
        this.status = FileStatus.PENDING;
        this.createdAt = now;
        this.uploadExpiresAt = uploadExpiresAt;
        this.pendingExpiresAt = now.plusSeconds(86400);
    }
    public void markReady(Instant now) { status = FileStatus.READY; uploadedAt = now; }
    public void markFailed() { status = FileStatus.FAILED; }
    public void markDeleting() { status = FileStatus.DELETING; }
}
