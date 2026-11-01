package com.growtogether.storage.config;

import com.growtogether.storage.infrastructure.*;
import java.time.Duration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
@EnableConfigurationProperties(StorageProperties.class)
public class S3Config {
    @Configuration
    @ConditionalOnProperty(name = "app.storage.enabled", havingValue = "true")
    static class Enabled {
        @Bean DefaultCredentialsProvider storageCredentials() { return DefaultCredentialsProvider.builder().build(); }
        @Bean S3Client storageClient(StorageProperties properties, DefaultCredentialsProvider credentials) {
            validate(properties);
            var builder = S3Client.builder().region(Region.of(properties.region())).credentialsProvider(credentials)
                    .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(properties.pathStyle()).build())
                    .overrideConfiguration(c -> c.apiCallTimeout(Duration.ofSeconds(20)).apiCallAttemptTimeout(Duration.ofSeconds(5)));
            if (properties.endpoint() != null) builder.endpointOverride(properties.endpoint());
            return builder.build();
        }
        @Bean S3Presigner storagePresigner(StorageProperties properties, DefaultCredentialsProvider credentials) {
            var builder = S3Presigner.builder().region(Region.of(properties.region())).credentialsProvider(credentials)
                    .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(properties.pathStyle()).build());
            if (properties.endpoint() != null) builder.endpointOverride(properties.endpoint());
            return builder.build();
        }
        @Bean StorageService storageService(S3Client client, S3Presigner presigner, StorageProperties properties) {
            return new S3StorageService(client, presigner, properties);
        }
        private static void validate(StorageProperties properties) {
            if (properties.bucket() == null || properties.bucket().isBlank()
                    || properties.region() == null || properties.region().isBlank()) {
                throw new IllegalArgumentException("Storage bucket and region are required when storage is enabled");
            }
        }
    }
    @Bean
    @ConditionalOnProperty(name = "app.storage.enabled", havingValue = "false", matchIfMissing = true)
    StorageService disabledStorage() {
        return new StorageService() {
            private ResponseStatusException disabled() {
                return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "File storage is not configured");
            }
            public SignedUrl generatePresignedUploadUrl(String key, String type, long size) { throw disabled(); }
            public SignedUrl generatePresignedDownloadUrl(String key) { throw disabled(); }
            public ObjectMetadata getObjectMetadata(String key) { throw disabled(); }
            public void deleteObject(String key) { throw disabled(); }
        };
    }
}
