package com.growtogether.storage;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Service
public class StorageDeletionJobs {
    private static final Logger log = LoggerFactory.getLogger(StorageDeletionJobs.class);
    private final JdbcTemplate db;
    private final StorageService storage;
    private final Clock clock;
    public StorageDeletionJobs(JdbcTemplate db, StorageService storage, Clock clock) {
        this.db = db; this.storage = storage; this.clock = clock;
    }
    private record Job(String key, Instant finalAfter, int attempts) {}

    @Transactional
    public void processBatch() {
        var now = clock.instant();
        // Keep row locks through deletion: concurrent instances cannot complete the same job.
        var jobs = db.query("""
            SELECT object_key, final_after, attempts FROM storage_deletion_jobs
            WHERE next_attempt_at <= ? ORDER BY next_attempt_at LIMIT 10 FOR UPDATE SKIP LOCKED
            """, (rs, row) -> new Job(rs.getString(1), rs.getTimestamp(2).toInstant(), rs.getInt(3)), Timestamp.from(now));
        for (var job : jobs) {
            try {
                deleteIfPresent(job.key());
                if (!now.isBefore(job.finalAfter())) {
                    db.update("DELETE FROM storage_deletion_jobs WHERE object_key = ?", job.key());
                } else {
                    db.update("UPDATE storage_deletion_jobs SET next_attempt_at = ?, attempts = 0 WHERE object_key = ?",
                            Timestamp.from(job.finalAfter()), job.key());
                }
            } catch (RuntimeException failure) {
                long seconds = Math.min(3600, 30L << Math.min(job.attempts(), 6));
                db.update("UPDATE storage_deletion_jobs SET attempts = attempts + 1, next_attempt_at = ? WHERE object_key = ?",
                        Timestamp.from(now.plus(Duration.ofSeconds(seconds))), job.key());
                // No object keys, credentials, filenames or exception messages in logs.
                log.warn("Storage deletion failed; durable retry scheduled");
            }
        }
    }
    private void deleteIfPresent(String key) {
        try { storage.delete(key); }
        catch (S3Exception missing) { if (missing.statusCode() != 404) throw missing; }
    }
}
