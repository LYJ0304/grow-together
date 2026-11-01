package com.growtogether.storage;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.growtogether.auth.AuthRepository;
import com.growtogether.user.User;
import com.growtogether.storage.domain.*;
import com.growtogether.storage.infrastructure.StorageService;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
@SpringBootTest(properties = {"spring.datasource.driver-class-name=org.postgresql.Driver", "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate", "app.storage.cleanup-enabled=false"})
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class StorageIntegrationTest {
    @Container static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
    @Autowired FileRepository files;
    @Autowired FileService service;
    @Autowired AuthRepository users;
    @MockitoBean StorageService storage;
    Long owner;
    @BeforeEach void setup() {
        files.deleteAll();
        owner = users.saveAndFlush(new User("Owner", UUID.randomUUID() + "@example.com", "unused-test-hash")).getId();
    }
    StoredFile save(Instant created, Instant expiry) {
        return files.saveAndFlush(new StoredFile(UUID.randomUUID(), owner, "a.jpg", "image/jpeg", 10, created, expiry));
    }
    @Test void failedCompletionAndDeleteCommitStateAndCanBeRetried() {
        var file = save(Instant.now(), Instant.now().plusSeconds(300));
        when(storage.getObjectMetadata(file.getObjectKey())).thenReturn(new StorageService.ObjectMetadata(11, "image/jpeg"));
        assertThatThrownBy(() -> service.completeUpload(owner, file.getId())).isInstanceOf(ResponseStatusException.class);
        assertThat(files.findById(file.getId()).orElseThrow().getStatus()).isEqualTo(FileStatus.FAILED);
        doThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE)).when(storage).deleteObject(file.getObjectKey());
        assertThatThrownBy(() -> service.deleteFile(owner, file.getId())).isInstanceOf(ResponseStatusException.class);
        assertThat(files.findById(file.getId()).orElseThrow().getStatus()).isEqualTo(FileStatus.DELETING);
    }
    @Test void cleanupQueryAndRetryDeleteOnlyExpiredDiscardedFiles() {
        var expired = save(Instant.now().minusSeconds(90000), Instant.now().minusSeconds(89700));
        var pending = save(Instant.now(), Instant.now().plusSeconds(300));
        var ready = save(Instant.now().minusSeconds(90000), Instant.now().minusSeconds(89700));
        ready.markReady(Instant.now()); files.saveAndFlush(ready);
        assertThat(files.findCleanupCandidates(Instant.now(), PageRequest.of(0, 100))).containsExactly(expired.getId());
        doThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE)).when(storage).deleteObject(expired.getObjectKey());
        assertThatThrownBy(() -> service.cleanup(expired.getId())).isInstanceOf(ResponseStatusException.class);
        assertThat(files.existsById(expired.getId())).isTrue();
        doNothing().when(storage).deleteObject(expired.getObjectKey());
        service.cleanup(expired.getId());
        assertThat(files.existsById(expired.getId())).isFalse();
        assertThat(files.existsById(pending.getId())).isTrue();
        assertThat(files.existsById(ready.getId())).isTrue();
    }
}
