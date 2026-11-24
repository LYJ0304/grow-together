package com.growtogether.common.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;

import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
@EnableConfigurationProperties(S3Properties.class)
public class S3Config {

    @Bean
    public S3Client s3Client(S3Properties properties) {
        var builder = S3Client.builder().region(Region.of(properties.region()));
        if (properties.endpoint() != null) {
            builder.endpointOverride(properties.endpoint());
        }
        if (properties.pathStyle()) {
            builder.forcePathStyle(true);
        }
        return builder.build();
    }

    @Bean
    public S3Presigner s3Presigner(S3Properties properties) {
        var builder = S3Presigner.builder().region(Region.of(properties.region()));
        if (properties.presignEndpoint() != null) {
            builder.endpointOverride(properties.presignEndpoint());
        }
        if (properties.pathStyle()) {
            builder.serviceConfiguration(S3Configuration.builder()
                    .pathStyleAccessEnabled(true)
                    .checksumValidationEnabled(false)
                    .build());
        }
        return builder.build();
    }
}
