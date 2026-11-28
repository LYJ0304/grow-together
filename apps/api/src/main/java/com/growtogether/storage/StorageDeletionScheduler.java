package com.growtogether.storage;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "app.storage.deletion.enabled", havingValue = "true", matchIfMissing = true)
public class StorageDeletionScheduler {
    private final StorageDeletionJobs jobs;
    public StorageDeletionScheduler(StorageDeletionJobs jobs) { this.jobs = jobs; }
    @Scheduled(fixedDelayString = "${app.storage.deletion.poll-ms:30000}")
    public void process() { jobs.processBatch(); }
}
