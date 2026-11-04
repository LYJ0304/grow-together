package com.growtogether.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.growtogether.common.config.S3Properties;
import com.growtogether.storage.dto.PresignedUrlRequest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.util.unit.DataSize;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.services.s3.model.S3Exception;

@ExtendWith(MockitoExtension.class)
class FileServiceTest {
    private static final UUID ID = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-11-04T12:00:00Z");
    @Mock private StorageService storage;
    @Mock private StoredFileRepository files;
    private FileService service;

    @BeforeEach
    void setUp() {
        service = new FileService(storage, files,
                new S3Properties("ap-northeast-2", "test", Duration.ofMinutes(10), DataSize.ofMegabytes(10)),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void issueUploadUrl_savesPendingFileWithServerGeneratedKeyAndExpiry() {
        given(files.save(any())).willAnswer(invocation -> {
            StoredFile file = invocation.getArgument(0);
            ReflectionTestUtils.setField(file, "id", ID);
            return file;
        });
        given(storage.createUploadUrl(any(), any())).willReturn("https://example.com/upload");
        var response = service.issueUploadUrl(7L, new PresignedUrlRequest("photo.png", "image/png", 1234L));
        var captor = ArgumentCaptor.forClass(StoredFile.class);
        then(files).should().save(captor.capture());
        StoredFile saved = captor.getValue();
        assertThat(ReflectionTestUtils.getField(saved, "ownerId")).isEqualTo(7L);
        assertThat(ReflectionTestUtils.getField(saved, "status")).isEqualTo(FileStatus.PENDING);
        assertThat(response.objectKey()).startsWith("files/7/").doesNotContain("photo.png");
        assertThat(response.fileId()).isEqualTo(ID);
        assertThat(response.expiresAt()).isEqualTo(NOW.plusSeconds(600));
        assertThat(response.uploadUrl()).isEqualTo("https://example.com/upload");
        then(storage).should().createUploadUrl(response.objectKey(), "image/png");
    }

    @Test
    void issueUploadUrl_rejectsOversizedFileBeforeSavingOrSigning() {
        assertStatus(HttpStatus.BAD_REQUEST, () -> service.issueUploadUrl(7L,
                new PresignedUrlRequest("photo.png", "image/png", DataSize.ofMegabytes(10).toBytes() + 1)));
        then(files).shouldHaveNoInteractions();
        then(storage).shouldHaveNoInteractions();
    }

    @Test
    void completeUpload_checksActualMetadataAndCompletesFile() {
        StoredFile file = pending();
        given(files.findByIdAndOwnerId(ID, 7L)).willReturn(Optional.of(file));
        given(storage.getMetadata("files/7/object")).willReturn(new StorageObjectMetadata(1234L, "image/png"));
        var response = service.completeUpload(7L, ID);
        assertThat(response.id()).isEqualTo(ID);
        assertThat(response.filename()).isEqualTo("photo.png");
        assertThat(response.fileSize()).isEqualTo(1234L);
        assertThat(response.status()).isEqualTo(FileStatus.COMPLETED);
    }

    @Test
    void completeUpload_hidesMissingOrOtherOwnersFileBeforeContactingS3() {
        given(files.findByIdAndOwnerId(ID, 8L)).willReturn(Optional.empty());
        assertStatus(HttpStatus.NOT_FOUND, () -> service.completeUpload(8L, ID));
        then(storage).shouldHaveNoInteractions();
    }

    @Test
    void completeUpload_rejectsAlreadyCompletedFile() {
        StoredFile file = pending();
        file.complete(1234L);
        given(files.findByIdAndOwnerId(ID, 7L)).willReturn(Optional.of(file));
        assertStatus(HttpStatus.CONFLICT, () -> service.completeUpload(7L, ID));
        then(storage).shouldHaveNoInteractions();
    }

    @Test
    void completeUpload_rejectsMismatchedSizeOrContentTypeAndKeepsPending() {
        StoredFile file = pending();
        given(files.findByIdAndOwnerId(ID, 7L)).willReturn(Optional.of(file));
        for (var metadata : new StorageObjectMetadata[] {
                new StorageObjectMetadata(1235L, "image/png"),
                new StorageObjectMetadata(1234L, "text/plain")}) {
            given(storage.getMetadata("files/7/object")).willReturn(metadata);
            assertStatus(HttpStatus.BAD_REQUEST, () -> service.completeUpload(7L, ID));
            assertThat(ReflectionTestUtils.getField(file, "status")).isEqualTo(FileStatus.PENDING);
        }
    }

    @Test
    void completeUpload_returns404ForMissingS3Object() {
        given(files.findByIdAndOwnerId(ID, 7L)).willReturn(Optional.of(pending()));
        given(storage.getMetadata("files/7/object")).willThrow(S3Exception.builder().statusCode(404).build());
        assertStatus(HttpStatus.NOT_FOUND, () -> service.completeUpload(7L, ID));
    }

    private StoredFile pending() {
        StoredFile file = new StoredFile(7L, "files/7/object", "photo.png", "image/png", 1234L);
        ReflectionTestUtils.setField(file, "id", ID);
        ReflectionTestUtils.setField(file, "createdAt", NOW);
        return file;
    }

    private void assertStatus(HttpStatus status, Runnable operation) {
        assertThatThrownBy(operation::run).isInstanceOfSatisfying(ResponseStatusException.class,
                exception -> assertThat(exception.getStatusCode()).isEqualTo(status));
    }
}
