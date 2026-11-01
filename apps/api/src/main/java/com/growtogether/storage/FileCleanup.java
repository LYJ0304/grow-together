package com.growtogether.storage;

import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Component;

@Component
@EnableScheduling
@ConditionalOnProperty(name = {"app.storage.enabled", "app.storage.cleanup-enabled"}, havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class FileCleanup {
    private final FileRepository repository;
    private final FileService service;

    @Scheduled(fixedDelayString = "${app.storage.cleanup-interval-ms:3600000}",
            initialDelayString = "${app.storage.cleanup-interval-ms:3600000}")
    public void run() {
        for (var id : repository.findCleanupCandidates(Instant.now(), PageRequest.of(0, 100))) {
            try { service.cleanup(id); }
            catch (RuntimeException exception) {
                // Provider messages can contain credentials or signed URLs.
                log.warn("File cleanup failed for {}; will retry on next run", id);
            }
        }
    }
}
