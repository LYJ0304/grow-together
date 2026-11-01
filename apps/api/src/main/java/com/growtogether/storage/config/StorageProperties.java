package com.growtogether.storage.config;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.time.Duration;
@ConfigurationProperties("app.storage")
@Validated
public record StorageProperties(boolean enabled, String bucket, String region, URI endpoint,
        boolean pathStyle, @Min(1) @Max(900) int urlTtlSeconds) {
    public Duration urlTtl() { return Duration.ofSeconds(urlTtlSeconds); }
}
