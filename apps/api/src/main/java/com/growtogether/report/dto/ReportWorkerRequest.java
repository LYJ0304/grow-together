package com.growtogether.report.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ReportWorkerRequest(
    @JsonProperty("source_hash") String sourceHash,
    @JsonProperty("prompt_version") String promptVersion,
    ReportWorkerPeriod period,
    ReportWorkerMetrics metrics,
    @JsonProperty("child_context") ReportChildContext childContext,
    ReportWorkerSources sources
) {
    public static final String PROMPT_VERSION = "weekly-v2";
}
