package com.growtogether.storage;
import com.growtogether.storage.domain.StoredFile;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface FileRepository extends JpaRepository<StoredFile, UUID> {
    Optional<StoredFile> findByIdAndUserId(UUID id, Long userId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from StoredFile f where f.id = :id and f.userId = :userId")
    Optional<StoredFile> findOwnedForUpdate(@Param("id") UUID id, @Param("userId") Long userId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from StoredFile f where f.id = :id")
    Optional<StoredFile> findForUpdate(@Param("id") UUID id);
    @Query("""
            select f.id from StoredFile f
            where (f.status = com.growtogether.storage.domain.FileStatus.PENDING and f.pendingExpiresAt < :now)
               or (f.status in (com.growtogether.storage.domain.FileStatus.FAILED,
                                com.growtogether.storage.domain.FileStatus.DELETING) and f.uploadExpiresAt < :now)
            order by f.createdAt
            """)
    List<UUID> findCleanupCandidates(@Param("now") Instant now, Pageable pageable);
}
