package com.growtogether.storage;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.growtogether.storage.domain.*;
import com.growtogether.storage.dto.*;
import com.growtogether.storage.infrastructure.StorageService;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class FileServiceTest {
    @Mock FileRepository repository;
    @Mock StorageService storage;
    @InjectMocks FileService service;
    UUID id = UUID.randomUUID();
    StoredFile file = new StoredFile(id, 1L, "photo.jpg", "image/jpeg", 10,
            Instant.now(), Instant.now().plusSeconds(300));

    @Test void initiatesPendingUploadWithServerGeneratedKeyAndSignedHeaders() {
        when(storage.generatePresignedUploadUrl(anyString(), eq("image/jpeg"), eq(10L)))
                .thenReturn(new StorageService.SignedUrl("https://storage/upload", Instant.now().plusSeconds(300),
                        Map.of("Content-Type", "image/jpeg", "If-None-Match", "*")));
        var result = service.initiateUpload(1L, new UploadUrlRequest("photo.jpg", "image/jpeg", 10L));
        var captor = ArgumentCaptor.forClass(StoredFile.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo(result.id());
        assertThat(captor.getValue().getUserId()).isEqualTo(1L);
        assertThat(captor.getValue().getStatus()).isEqualTo(FileStatus.PENDING);
        assertThat(captor.getValue().getObjectKey()).isEqualTo("files/" + result.id());
        assertThat(result.headers()).containsEntry("If-None-Match", "*");
    }
    @Test void rejectsInvalidMimeExtensionSizeAndPathBeforeStorage() {
        for (var request : List.of(new UploadUrlRequest("a.jpg", "text/html", 10L),
                new UploadUrlRequest("a.exe", "image/jpeg", 10L),
                new UploadUrlRequest("../a.jpg", "image/jpeg", 10L),
                new UploadUrlRequest("a.jpg", "image/jpeg", 5242881L),
                new UploadUrlRequest("a.jpg", "image/jpeg", 0L))) {
            assertStatus(400, () -> service.initiateUpload(1L, request));
        }
        verifyNoInteractions(storage, repository);
    }
    @Test void completesOnlyWhenObjectMatchesAndIsIdempotent() {
        when(repository.findOwnedForUpdate(id, 1L)).thenReturn(Optional.of(file));
        when(storage.getObjectMetadata(file.getObjectKey())).thenReturn(new StorageService.ObjectMetadata(10, "image/jpeg"));
        service.completeUpload(1L, id);
        service.completeUpload(1L, id);
        assertThat(file.getStatus()).isEqualTo(FileStatus.READY);
        assertThat(file.getUploadedAt()).isNotNull();
        verify(storage, times(1)).getObjectMetadata(anyString());
    }
    @Test void mismatchedObjectBecomesFailedAndCannotBeDownloaded() {
        when(repository.findOwnedForUpdate(id, 1L)).thenReturn(Optional.of(file));
        when(storage.getObjectMetadata(file.getObjectKey())).thenReturn(new StorageService.ObjectMetadata(11, "image/jpeg"));
        assertStatus(409, () -> service.completeUpload(1L, id));
        assertThat(file.getStatus()).isEqualTo(FileStatus.FAILED);
        when(repository.findByIdAndUserId(id, 1L)).thenReturn(Optional.of(file));
        assertStatus(409, () -> service.generateDownloadUrl(1L, id));
        verify(storage, never()).generatePresignedDownloadUrl(anyString());
    }
    @Test void missingObjectRemainsPendingAndCanBeRetried() {
        when(repository.findOwnedForUpdate(id, 1L)).thenReturn(Optional.of(file));
        when(storage.getObjectMetadata(anyString())).thenThrow(new ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT, "Upload missing"));
        assertStatus(409, () -> service.completeUpload(1L, id));
        assertThat(file.getStatus()).isEqualTo(FileStatus.PENDING);
    }
    @Test void deniesEveryOperationForAnotherOwnerBeforeStorage() {
        when(repository.findOwnedForUpdate(id, 2L)).thenReturn(Optional.empty());
        when(repository.findByIdAndUserId(id, 2L)).thenReturn(Optional.empty());
        assertStatus(404, () -> service.completeUpload(2L, id));
        assertStatus(404, () -> service.deleteFile(2L, id));
        assertStatus(404, () -> service.getFileMetadata(2L, id));
        assertStatus(404, () -> service.generateDownloadUrl(2L, id));
        verifyNoInteractions(storage);
    }
    @Test void readyFileCanBeReadAndDownloaded() {
        file.markReady(Instant.now());
        when(repository.findByIdAndUserId(id, 1L)).thenReturn(Optional.of(file));
        when(storage.generatePresignedDownloadUrl(file.getObjectKey()))
                .thenReturn(new StorageService.SignedUrl("https://storage/download", Instant.now().plusSeconds(300), Map.of()));
        assertThat(service.getFileMetadata(1L, id).originalName()).isEqualTo("photo.jpg");
        assertThat(service.generateDownloadUrl(1L, id).downloadUrl()).isEqualTo("https://storage/download");
    }
    @Test void deletionKeepsTombstoneUntilUploadUrlExpires() {
        when(repository.findOwnedForUpdate(id, 1L)).thenReturn(Optional.of(file));
        service.deleteFile(1L, id);
        assertThat(file.getStatus()).isEqualTo(FileStatus.DELETING);
        verify(storage).deleteObject(file.getObjectKey());
        verify(repository, never()).delete(any());
    }
    @Test void deleteFailureStillRecordsDeletionForScheduledRetry() {
        when(repository.findOwnedForUpdate(id, 1L)).thenReturn(Optional.of(file));
        doThrow(new ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE)).when(storage).deleteObject(anyString());
        assertStatus(503, () -> service.deleteFile(1L, id));
        assertThat(file.getStatus()).isEqualTo(FileStatus.DELETING);
        verify(repository, never()).delete(any());
    }
    @Test void expiredPendingIsDeletedButReadyIsNeverCleaned() {
        var old = new StoredFile(id, 1L, "old.jpg", "image/jpeg", 10,
                Instant.now().minusSeconds(90000), Instant.now().minusSeconds(89700));
        when(repository.findForUpdate(id)).thenReturn(Optional.of(old));
        service.cleanup(id);
        verify(storage).deleteObject(old.getObjectKey());
        verify(repository).delete(old);
        old.markReady(Instant.now());
        clearInvocations(storage, repository);
        service.cleanup(id);
        verifyNoInteractions(storage);
        verify(repository, never()).delete(any());
    }
    @Test void cannotCompleteExpiredOrDeletingFile() {
        var old = new StoredFile(id, 1L, "old.jpg", "image/jpeg", 10,
                Instant.now().minusSeconds(90000), Instant.now().minusSeconds(89700));
        when(repository.findOwnedForUpdate(id, 1L)).thenReturn(Optional.of(old));
        assertStatus(409, () -> service.completeUpload(1L, id));
        old.markDeleting();
        assertStatus(409, () -> service.completeUpload(1L, id));
        verifyNoInteractions(storage);
    }
    private void assertStatus(int status, Runnable operation) {
        assertThatThrownBy(operation::run).isInstanceOfSatisfying(ResponseStatusException.class,
                exception -> assertThat(exception.getStatusCode().value()).isEqualTo(status));
    }
}
