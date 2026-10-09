package com.growtogether.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "refresh_tokens")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RefreshToken {
    @Id
    @Column(name = "token_hash", length = 64)
    private String tokenHash;
    @Column(name = "session_id", nullable = false)
    private UUID sessionId;
    @Column(nullable = false)
    private boolean used;

    public RefreshToken(String tokenHash, UUID sessionId) {
        this.tokenHash = tokenHash;
        this.sessionId = sessionId;
    }

    public void markUsed() { used = true; }
}
