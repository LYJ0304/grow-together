package com.growtogether.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.growtogether.auth.dto.LoginRequest;
import com.growtogether.auth.dto.LoginResponse;
import com.growtogether.auth.dto.SignUpRequest;
import com.growtogether.auth.dto.TokenRequest;
import com.jayway.jsonpath.JsonPath;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@Import({AuthIntegrationTest.TestClockConfig.class, AuthIntegrationTest.ProtectedController.class})
class AuthIntegrationTest {
    private static final String JWT_SECRET = Base64.getEncoder().encodeToString(new SecureRandom().generateSeed(32));
    private static final String EMAIL = "tester@example.com";
    private static final String PASSWORD = "test-password-123";
    private static final Instant START = Instant.parse("2026-10-09T00:00:00Z");
    @Container static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("app.jwt.secret", () -> JWT_SECRET);
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired MockMvc mvc;
    @Autowired AuthRepository users;
    @Autowired AuthSessionRepository sessions;
    @Autowired RefreshTokenRepository refreshTokens;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired MutableClock clock;

    @BeforeEach
    void reset() {
        refreshTokens.deleteAllInBatch();
        sessions.deleteAllInBatch();
        users.deleteAllInBatch();
        clock.set(START);
    }

    @Test
    void signupStoresOnlyEncodedPasswordAndCanonicalEmail() throws Exception {
        signup("TESTER@example.com", PASSWORD).andExpect(status().isCreated());
        var user = users.findByEmail(EMAIL).orElseThrow();
        assertThat(user.getName()).isEqualTo("Tester");
        assertThat(user.getPasswordHash()).isNotEqualTo(PASSWORD);
        assertThat(passwordEncoder.matches(PASSWORD, user.getPasswordHash())).isTrue();
    }

    @Test
    void duplicateEmailReturnsConflict() throws Exception {
        signup(EMAIL, PASSWORD).andExpect(status().isCreated());
        signup("TESTER@example.com", PASSWORD).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_EXISTS"));
        assertThat(users.count()).isEqualTo(1);
    }

    @Test
    void concurrentSignupCannotCreateDuplicates() throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        var first = CompletableFuture.supplyAsync(() -> signupStatus(start));
        var second = CompletableFuture.supplyAsync(() -> signupStatus(start));
        start.countDown();
        assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder(201, 409);
        assertThat(users.count()).isEqualTo(1);
    }

    @Test
    void validationErrorsAndMalformedJsonReturn400() throws Exception {
        mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"\",\"email\":\"bad\",\"password\":\"short\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content("{"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/auth/logout").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.TEXT_PLAIN).content("not-json"))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void corsPreflightAllowsOnlyConfiguredOrigins() throws Exception {
        mvc.perform(options("/api/v1/auth/login").header("Origin", "http://localhost:8081")
                .header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "content-type,authorization"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:8081"));
        mvc.perform(options("/api/v1/auth/login").header("Origin", "https://untrusted.example")
                .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden()).andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void bcryptLimitIsCheckedInUtf8Bytes() throws Exception {
        signup(EMAIL, "가".repeat(25)).andExpect(status().isBadRequest());
        assertThat(users.count()).isZero();
        signup(EMAIL, "가".repeat(24)).andExpect(status().isCreated());
        login(EMAIL, "가".repeat(24)).andExpect(status().isOk());
    }

    @Test
    void wrongPasswordAndUnknownUserHaveTheSameResponse() throws Exception {
        signup(EMAIL, PASSWORD).andExpect(status().isCreated());
        var unknown = login("unknown@example.com", PASSWORD).andExpect(status().isUnauthorized()).andReturn();
        var wrong = login(EMAIL, "wrong-password").andExpect(status().isUnauthorized()).andReturn();
        assertThat(unknown.getResponse().getContentAsString()).isEqualTo(wrong.getResponse().getContentAsString());
    }

    @Test
    void loginIssuesTokensWithoutSessionCookiesOrCachedResponse() throws Exception {
        signup(EMAIL, PASSWORD).andExpect(status().isCreated());
        var result = login("TESTER@example.com", PASSWORD).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().doesNotExist("Set-Cookie"))
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.expiresIn").value(900)).andReturn();
        TokenPair pair = tokens(result);
        assertThat(pair.refresh()).hasSize(43);
        assertThat(refreshTokens.findAll()).allMatch(token -> token.getTokenHash().length() == 64)
                .noneMatch(token -> token.getTokenHash().equals(pair.refresh()));
        protectedRequest(pair.access()).andExpect(status().isOk());
        mvc.perform(get("/test/protected")).andExpect(status().isUnauthorized());
    }

    @Test
    void expiredAndTamperedAccessTokensAreRejected() throws Exception {
        TokenPair pair = registeredLogin();
        String[] parts = pair.access().split("\\.");
        String signature = parts[2];
        String forged = parts[0] + "." + parts[1] + "." + (signature.charAt(0) == 'a' ? 'b' : 'a') + signature.substring(1);
        protectedRequest(forged).andExpect(status().isUnauthorized());
        clock.set(START.plusSeconds(900));
        protectedRequest(pair.access()).andExpect(status().isUnauthorized());
    }

    @Test
    void refreshRotatesTokenAndWorksWithExpiredAuthorizationHeader() throws Exception {
        TokenPair pair = registeredLogin();
        clock.set(START.plusSeconds(901));
        TokenPair rotated = tokens(mvc.perform(post("/api/v1/auth/refresh")
                .header("Authorization", "Bearer " + pair.access()).contentType(MediaType.APPLICATION_JSON)
                .content(tokenJson(pair.refresh()))).andExpect(status().isOk()).andReturn());
        assertThat(rotated.refresh()).isNotEqualTo(pair.refresh());
        protectedRequest(rotated.access()).andExpect(status().isOk());
        assertThat(refreshTokens.findAll()).filteredOn(RefreshToken::isUsed).hasSize(1);
    }

    @Test
    void replayOfUsedRefreshTokenRevokesEntireSession() throws Exception {
        TokenPair pair = registeredLogin();
        TokenPair rotated = tokens(refresh(pair.refresh()).andExpect(status().isOk()).andReturn());
        refresh(pair.refresh()).andExpect(status().isUnauthorized());
        protectedRequest(pair.access()).andExpect(status().isUnauthorized());
        protectedRequest(rotated.access()).andExpect(status().isUnauthorized());
        refresh(rotated.refresh()).andExpect(status().isUnauthorized());
        assertThat(sessions.findAll()).allMatch(AuthSession::isRevoked);
    }

    @Test
    void simultaneousRefreshRequestsCannotBothSucceed() throws Exception {
        TokenPair pair = registeredLogin();
        CountDownLatch start = new CountDownLatch(1);
        var first = CompletableFuture.supplyAsync(() -> refreshStatus(start, pair.refresh()));
        var second = CompletableFuture.supplyAsync(() -> refreshStatus(start, pair.refresh()));
        start.countDown();
        assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder(200, 401);
        protectedRequest(pair.access()).andExpect(status().isUnauthorized());
    }

    @Test
    void expiredRefreshSessionCannotBeRenewed() throws Exception {
        TokenPair pair = registeredLogin();
        clock.set(START.plusSeconds(1209600));
        refresh(pair.refresh()).andExpect(status().isUnauthorized());
        refresh("unknown-token").andExpect(status().isUnauthorized());
    }

    @Test
    void logoutIsIdempotentAndOnlyRevokesThatDeviceSession() throws Exception {
        TokenPair first = registeredLogin();
        TokenPair second = tokens(login(EMAIL, PASSWORD).andExpect(status().isOk()).andReturn());
        logout(first.refresh()).andExpect(status().isNoContent());
        logout(first.refresh()).andExpect(status().isNoContent());
        logout("unknown-token").andExpect(status().isNoContent());
        protectedRequest(first.access()).andExpect(status().isUnauthorized());
        refresh(first.refresh()).andExpect(status().isUnauthorized());
        protectedRequest(second.access()).andExpect(status().isOk());
        refresh(second.refresh()).andExpect(status().isOk());
    }

    @Test
    void dtoStringsDoNotExposeCredentials() {
        assertThat(new SignUpRequest("name", EMAIL, PASSWORD).toString()).doesNotContain(PASSWORD);
        assertThat(new LoginRequest(EMAIL, PASSWORD).toString()).doesNotContain(PASSWORD);
        assertThat(new TokenRequest("secret-token").toString()).doesNotContain("secret-token");
        assertThat(new LoginResponse("secret-access", "secret-refresh", "Bearer", 900).toString())
                .doesNotContain("secret-access", "secret-refresh");
    }

    private TokenPair registeredLogin() throws Exception {
        signup(EMAIL, PASSWORD).andExpect(status().isCreated());
        return tokens(login(EMAIL, PASSWORD).andExpect(status().isOk()).andReturn());
    }

    private org.springframework.test.web.servlet.ResultActions signup(String email, String password) throws Exception {
        return mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\" Tester \",\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"));
    }

    private org.springframework.test.web.servlet.ResultActions login(String email, String password) throws Exception {
        return mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"));
    }

    private org.springframework.test.web.servlet.ResultActions refresh(String token) throws Exception {
        return mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON).content(tokenJson(token)));
    }

    private org.springframework.test.web.servlet.ResultActions logout(String token) throws Exception {
        return mvc.perform(post("/api/v1/auth/logout").contentType(MediaType.APPLICATION_JSON).content(tokenJson(token)));
    }

    private org.springframework.test.web.servlet.ResultActions protectedRequest(String access) throws Exception {
        return mvc.perform(get("/test/protected").header("Authorization", "Bearer " + access));
    }

    private static String tokenJson(String token) { return "{\"refreshToken\":\"" + token + "\"}"; }

    private static TokenPair tokens(MvcResult result) throws Exception {
        String body = result.getResponse().getContentAsString();
        return new TokenPair(JsonPath.read(body, "$.accessToken"), JsonPath.read(body, "$.refreshToken"));
    }

    private int signupStatus(CountDownLatch start) {
        try { start.await(); return signup(EMAIL, PASSWORD).andReturn().getResponse().getStatus(); }
        catch (Exception error) { throw new IllegalStateException(error); }
    }

    private int refreshStatus(CountDownLatch start, String token) {
        try { start.await(); return refresh(token).andReturn().getResponse().getStatus(); }
        catch (Exception error) { throw new IllegalStateException(error); }
    }

    private record TokenPair(String access, String refresh) {}

    @RestController
    static class ProtectedController {
        @GetMapping("/test/protected")
        Map<String, String> protectedEndpoint(@AuthenticationPrincipal Jwt jwt) {
            return Map.of("userId", jwt.getSubject());
        }
    }

    @TestConfiguration
    static class TestClockConfig {
        @Bean @Primary MutableClock testClock() { return new MutableClock(); }
    }

    static class MutableClock extends Clock {
        private final AtomicReference<Instant> current = new AtomicReference<>(START);
        void set(Instant instant) { current.set(instant); }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return current.get(); }
    }
}
