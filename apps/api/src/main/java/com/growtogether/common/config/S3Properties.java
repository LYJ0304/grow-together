package com.growtogether.common.config;

import java.net.URI;
import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;


@ConfigurationProperties(prefix = "app.storage.s3")
public record S3Properties(
    String region,
    String bucket,
    Duration presignedUrlExpiration,
    DataSize maxFileSize,
    URI endpoint,
    URI presignEndpoint,
    boolean pathStyle
) {
    public S3Properties {
        endpoint = absentIfEmpty(endpoint);
        presignEndpoint = absentIfEmpty(presignEndpoint);
    }

    private static URI absentIfEmpty(URI uri) {
        return uri != null && uri.toString().isEmpty() ? null : uri;
    }
}
