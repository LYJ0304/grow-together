package com.growtogether.report.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record ReportWorkerMetrics(
    long planned,
    long eligible,
    long completed,
    @JsonProperty("diary_days") long diaryDays,
    @JsonProperty("completion_rate") Double completionRate,
    List<ReportDaily> daily
) {}
