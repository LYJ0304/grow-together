package com.growtogether.auth.jwt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.security.SecureRandom;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class JwtConfigTest {
    private final JwtConfig config = new JwtConfig();

    @Test
    void rejectsAbsentMalformedAndShortSigningKeys() {
        assertThatThrownBy(() -> config.jwtSigningKey("")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> config.jwtSigningKey("not-base64!")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> config.jwtSigningKey(Base64.getEncoder().encodeToString(new byte[16])))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void acceptsRuntimeGeneratedKey() {
        byte[] bytes = new SecureRandom().generateSeed(32);
        var key = config.jwtSigningKey(Base64.getEncoder().encodeToString(bytes));
        assertThat(key.getAlgorithm()).isEqualTo("HmacSHA256");
        assertThat(key.getEncoded()).hasSize(32);
    }
}
