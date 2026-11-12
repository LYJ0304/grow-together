package com.growtogether.report.dto;

import java.time.LocalDate;

public record ReportDaily(
    LocalDate date,
    long completed
) {}
