package com.growtogether.auth;

import com.growtogether.auth.dto.LoginRequest;
import com.growtogether.auth.dto.LoginResponse;
import com.growtogether.auth.dto.SignUpRequest;
import com.growtogether.auth.jwt.JwtTokenProvider;
import com.growtogether.user.User;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final AuthRepository users;
    private final AuthSessionRepository sessions;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokens;
    private final Clock clock;
    private final long sessionSeconds;
    private final SecureRandom random = new SecureRandom();
    private final String dummyPasswordHash;

    public AuthService(AuthRepository users, AuthSessionRepository sessions,
            RefreshTokenRepository refreshTokens, PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokens, Clock clock,
            @Value("${app.jwt.refresh-session-seconds}") long sessionSeconds) {
        if (sessionSeconds <= 0) throw new IllegalArgumentException("Refresh session lifetime must be positive");
        this.users = users;
        this.sessions = sessions;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokens = jwtTokens;
        this.clock = clock;
        this.sessionSeconds = sessionSeconds;
        this.dummyPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    public void signup(SignUpRequest request) {
        validatePassword(request.password());
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) throw duplicateEmail();
        User user = new User(request.name().strip(), email, passwordEncoder.encode(request.password()));
        try {
            users.saveAndFlush(user);
        } catch (DataIntegrityViolationException exception) {
            for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
                if (cause instanceof ConstraintViolationException violation
                        && "uk_users_email".equals(violation.getConstraintName())) {
                    throw duplicateEmail();
                }
            }
            throw exception;
        }
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        validatePassword(request.password());
        User user = users.findByEmail(normalizeEmail(request.email())).orElse(null);
        boolean matches = passwordEncoder.matches(request.password(),
                user == null ? dummyPasswordHash : user.getPasswordHash());
        if (user == null || !matches) {
            throw new AuthException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid email or password");
        }
        AuthSession session = new AuthSession(user.getId(),
                clock.instant().truncatedTo(ChronoUnit.SECONDS).plusSeconds(sessionSeconds));
        sessions.save(session);
        return response(session, issueRefreshToken(session));
    }

    // Replay detection must commit revocation even though the response is 401.
    @Transactional(noRollbackFor = AuthException.class)
    public LoginResponse refresh(String rawToken) {
        String hash = tokenHash(rawToken);
        UUID sessionId = refreshTokens.findSessionIdByTokenHash(hash).orElseThrow(AuthService::invalidRefreshToken);
        AuthSession session = sessions.findLockedById(sessionId).orElseThrow(AuthService::invalidRefreshToken);
        if (!session.isActive(clock.instant())) throw invalidRefreshToken();
        // Read after the session lock so concurrent rotations see the latest used flag.
        RefreshToken token = refreshTokens.findById(hash).orElseThrow(AuthService::invalidRefreshToken);
        if (token.isUsed()) {
            session.revoke();
            throw invalidRefreshToken();
        }
        token.markUsed();
        return response(session, issueRefreshToken(session));
    }

    @Transactional
    public void logout(String rawToken) {
        refreshTokens.findSessionIdByTokenHash(tokenHash(rawToken))
                .flatMap(sessions::findLockedById).ifPresent(AuthSession::revoke);
    }

    private LoginResponse response(AuthSession session, String refreshToken) {
        Jwt jwt = jwtTokens.issue(session);
        return new LoginResponse(jwt.getTokenValue(), refreshToken, "Bearer",
                Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt()).getSeconds());
    }

    private String issueRefreshToken(AuthSession session) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        refreshTokens.save(new RefreshToken(tokenHash(rawToken), session.getId()));
        return rawToken;
    }

    private static String tokenHash(String rawToken) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static String normalizeEmail(String email) {
        String normalized = email.strip().toLowerCase(Locale.ROOT);
        if (normalized.length() > 254) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Email is too long");
        }
        return normalized;
    }

    private static void validatePassword(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Password must not exceed 72 UTF-8 bytes");
        }
    }

    private static AuthException duplicateEmail() {
        return new AuthException(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS", "Email is already registered");
    }

    private static AuthException invalidRefreshToken() {
        return new AuthException(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
    }
}
