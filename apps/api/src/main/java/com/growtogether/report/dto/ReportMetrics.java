package com.growtogether.report.dto;

import java.util.List;

public record ReportMetrics(
    long planned,
    long eligible,
    long completed,
    long diaryDays,
    Double completionRate,
    List<ReportDaily> daily
) {}
