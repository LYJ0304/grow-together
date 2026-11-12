package com.growtogether.report.dto;

import java.util.List;

public record WeeklyReportResponse(
    ReportPeriod period,
    ReportMetrics metrics,
    List<ReportActivity> majorActivities,
    boolean activitiesTruncated,
    List<ReportMemory> memories,
    String sourceHash,
    String promptVersion,
    ReportInsight insight
) {}
