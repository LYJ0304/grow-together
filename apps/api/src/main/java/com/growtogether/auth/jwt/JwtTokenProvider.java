package com.growtogether.auth.jwt;

import com.growtogether.auth.AuthSession;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenProvider {
    private final JwtEncoder encoder;
    private final Clock clock;
    private final long accessSeconds;

    public JwtTokenProvider(JwtEncoder encoder, Clock clock,
            @Value("${app.jwt.access-token-seconds}") long accessSeconds) {
        if (accessSeconds <= 0) throw new IllegalArgumentException("Access token lifetime must be positive");
        this.encoder = encoder;
        this.clock = clock;
        this.accessSeconds = accessSeconds;
    }

    public Jwt issue(AuthSession session) {
        Instant now = clock.instant().truncatedTo(ChronoUnit.SECONDS);
        Instant expiry = now.plusSeconds(accessSeconds);
        if (expiry.isAfter(session.getExpiresAt())) expiry = session.getExpiresAt().truncatedTo(ChronoUnit.SECONDS);
        JwtClaimsSet claims = JwtClaimsSet.builder().issuer(JwtConfig.ISSUER)
                .subject(session.getUserId().toString()).id(UUID.randomUUID().toString())
                .issuedAt(now).notBefore(now).expiresAt(expiry)
                .claim("sid", session.getId().toString()).build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims));
    }
}
