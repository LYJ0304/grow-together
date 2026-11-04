package com.growtogether.common.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;


@ConfigurationProperties(prefix = "app.storage.s3")
public record S3Properties(
    String region,
    String bucket,
    Duration presignedUrlExpiration,
    DataSize maxFileSize
) {
}
