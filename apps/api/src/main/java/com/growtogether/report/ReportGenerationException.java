package com.growtogether.report;

final class ReportGenerationException extends RuntimeException {
    private final String reason;
    ReportGenerationException(String reason) { super("Report generation unavailable"); this.reason = reason; }
    String reason() { return reason; }
}
