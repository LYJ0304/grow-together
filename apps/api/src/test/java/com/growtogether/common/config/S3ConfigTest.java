package com.growtogether.common.config;

import java.net.URI;
import java.time.Duration;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import static org.assertj.core.api.Assertions.assertThat;

class S3ConfigTest {
    private final S3Config config = new S3Config();

    @Test
    void usesInternalEndpointForRequestsAndTailnetEndpointForPathStyleSignatures() {
        S3Properties properties = properties(Map.of(
                "endpoint", "http://minio:9000",
                "presign-endpoint", "https://stage.example.ts.net:9443",
                "path-style", "true"));

        try (var client = config.s3Client(properties); var presigner = config.s3Presigner(properties)) {
            assertThat(client.serviceClientConfiguration().endpointOverride())
                    .contains(URI.create("http://minio:9000"));
            assertThat(downloadUrl(presigner).toString())
                    .startsWith("https://stage.example.ts.net:9443/staging-files/files/1/photo.png?");
        }
    }

    @Test
    void usesAwsDefaultsWhenCompatibleStorageSettingsAreAbsent() {
        S3Properties properties = properties(Map.of("endpoint", "", "presign-endpoint", ""));

        try (var client = config.s3Client(properties); var presigner = config.s3Presigner(properties)) {
            assertThat(client.serviceClientConfiguration().endpointOverride()).isEmpty();
            assertThat(downloadUrl(presigner).toString())
                    .startsWith("https://staging-files.s3.ap-northeast-2.amazonaws.com/files/1/photo.png?");
        }
    }

    private static URI downloadUrl(S3Presigner presigner) {
        return URI.create(presigner.presignGetObject(request -> request
                .signatureDuration(Duration.ofMinutes(10))
                .getObjectRequest(GetObjectRequest.builder()
                        .bucket("staging-files")
                        .key("files/1/photo.png")
                        .overrideConfiguration(override -> override.credentialsProvider(
                                StaticCredentialsProvider.create(AwsBasicCredentials.create("test-key", "test-secret"))))
                        .build()))
                .url().toString());
    }

    private static S3Properties properties(Map<String, String> overrides) {
        var source = new MapConfigurationPropertySource(Map.of(
                "app.storage.s3.region", "ap-northeast-2",
                "app.storage.s3.bucket", "staging-files",
                "app.storage.s3.presigned-url-expiration", "10m",
                "app.storage.s3.max-file-size", "10MB"));
        overrides.forEach((key, value) -> source.put("app.storage.s3." + key, value));
        return new Binder(source).bind("app.storage.s3", S3Properties.class).get();
    }
}
