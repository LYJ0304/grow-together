package com.growtogether.storage;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.growtogether.storage.config.StorageProperties;
import com.growtogether.storage.infrastructure.S3StorageService;
import java.net.URI;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.auth.credentials.*;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.*;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
class S3StorageServiceTest {
    S3Client client = mock(S3Client.class);
    StorageProperties properties = new StorageProperties(true, "private-files", "auto",
            URI.create("https://account.r2.cloudflarestorage.com"), false, 300);
    @Test void signsPutAgainstConfiguredEndpointIncludingTypeSizeAndConditionalWrite() {
        try (var presigner = S3Presigner.builder().endpointOverride(properties.endpoint()).region(Region.of("auto"))
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create("test-key", "test-secret"))).build()) {
            var service = new S3StorageService(client, presigner, properties);
            var signed = service.generatePresignedUploadUrl("files/abc", "image/jpeg", 10);
            assertThat(signed.url()).startsWith("https://private-files.account.r2.cloudflarestorage.com/files/abc?")
                    .contains("X-Amz-Expires=300")
                    .contains("content-length", "content-type", "if-none-match");
            assertThat(signed.headers()).containsEntry("Content-Type", "image/jpeg")
                    .containsEntry("Content-Length", "10").containsEntry("If-None-Match", "*");
            var download = service.generatePresignedDownloadUrl("files/abc");
            assertThat(download.url()).contains("X-Amz-Signature=").doesNotContain("if-none-match");
        }
    }
    @Test void headUsesBucketAndKeyAndReturnsMetadata() {
        when(client.headObject(any(HeadObjectRequest.class))).thenReturn(
                HeadObjectResponse.builder().contentLength(10L).contentType("image/jpeg").build());
        var service = new S3StorageService(client, null, properties);
        assertThat(service.getObjectMetadata("files/abc").size()).isEqualTo(10);
        verify(client).headObject(argThat((HeadObjectRequest r) -> r.bucket().equals("private-files") && r.key().equals("files/abc")));
    }
    @Test void missingObjectIsConflictButProviderErrorsAreSanitized503() {
        var service = new S3StorageService(client, null, properties);
        when(client.headObject(any(HeadObjectRequest.class))).thenThrow(NoSuchKeyException.builder().statusCode(404).build());
        assertThatThrownBy(() -> service.getObjectMetadata("files/abc"))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode().value()).isEqualTo(409));
        doThrow(S3Exception.builder().statusCode(403).message("secret provider diagnostic").build())
                .when(client).deleteObject(any(DeleteObjectRequest.class));
        assertThatThrownBy(() -> service.deleteObject("files/abc"))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode().value()).isEqualTo(503);
                    assertThat(e.getReason()).doesNotContain("secret");
                });
    }
}
