package com.growtogether.storage;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Getter
@Entity
@Table(
    name = "stored_files",
    indexes = {
        @Index(name = "idx_stored_files_owner", columnList = "owner_id"),
        @Index(name = "idx_stored_files_status", columnList = "status")
    }
)
public class StoredFile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(nullable = false, unique = true, length = 1024)
    private String objectKey;

    @Column(nullable = false)
    private String originalFilename;

    @Column(nullable = false, length = 100)
    private String contentType;

    @Column(nullable = false)
    private Long fileSize;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FileStatus status;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    private Instant completedAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    protected StoredFile() {

    }

    public StoredFile(
            Long ownerId,
            String objectKey,
            String originalFilename,
            String contentType,
            Long fileSize
    ) {
        this.ownerId = ownerId;
        this.objectKey = objectKey;
        this.originalFilename = originalFilename;
        this.contentType = contentType;
        this.fileSize = fileSize;
        this.status = FileStatus.PENDING;
    }

    public void complete(long actualFileSize) {
        if (status != FileStatus.PENDING) {
            throw new IllegalStateException("완료할 수 없는 파일 상태입니다.");
        }

        this.fileSize = actualFileSize;
        this.status = FileStatus.COMPLETED;
        this.completedAt = Instant.now();
    }
}
