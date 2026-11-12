package com.growtogether.report.dto;

public record ReportInsight(
    ReportInsightState state,
    String reason,
    ReportInsightResult result
) {
    public static ReportInsight of(ReportInsightState state, String reason) {
        return new ReportInsight(state, reason, null);
    }
}
