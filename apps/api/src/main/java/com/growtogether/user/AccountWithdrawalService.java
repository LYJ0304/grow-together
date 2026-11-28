package com.growtogether.user;

import com.growtogether.auth.AuthException;
import com.growtogether.common.config.S3Properties;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountWithdrawalService {
    private final JdbcTemplate db;
    private final PasswordEncoder passwords;
    private final Clock clock;
    private final S3Properties storage;
    private final ApplicationEventPublisher events;

    public AccountWithdrawalService(JdbcTemplate db, PasswordEncoder passwords, Clock clock,
            S3Properties storage, ApplicationEventPublisher events) {
        this.db = db; this.passwords = passwords; this.clock = clock;
        this.storage = storage; this.events = events;
    }

    @Transactional
    public void withdraw(Long owner, String password) {
        // Parent row lock serializes withdrawal with FK-backed new records.
        var hashes = db.queryForList("SELECT password_hash FROM users WHERE id = ? FOR UPDATE", String.class, owner);
        if (hashes.isEmpty()) throw new AuthException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Login required");
        if (password.getBytes(StandardCharsets.UTF_8).length > 72
                || !passwords.matches(password, hashes.getFirst()))
            throw new AuthException(HttpStatus.BAD_REQUEST, "INVALID_PASSWORD", "현재 비밀번호를 확인해주세요.");
        var now = clock.instant();
        // A final sweep after signed PUT expiry also removes objects recreated after the first delete.
        var finalAfter = now.plus(storage.presignedUrlExpiration()).plus(Duration.ofHours(1));
        db.update("""
            INSERT INTO storage_deletion_jobs (object_key, next_attempt_at, final_after)
            SELECT object_key, ?, ? FROM stored_files WHERE owner_id = ?
            """, Timestamp.from(now), Timestamp.from(finalAfter), owner);
        db.update("DELETE FROM todo WHERE user_id = ?", owner);
        db.update("DELETE FROM diary WHERE user_id = ?", owner);
        db.update("DELETE FROM stored_files WHERE owner_id = ?", owner);
        // Child personalization and all device sessions/refresh tokens cascade from users.
        db.update("DELETE FROM users WHERE id = ?", owner);
        events.publishEvent(new AccountWithdrawn(owner));
    }
}
