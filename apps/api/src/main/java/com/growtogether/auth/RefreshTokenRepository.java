package com.growtogether.auth;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, String> {
    @Query("select t.sessionId from RefreshToken t where t.tokenHash = :hash")
    Optional<UUID> findSessionIdByTokenHash(@Param("hash") String hash);
}
