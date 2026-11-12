package com.growtogether.report.dto;

import java.time.LocalDate;

public record ReportWorkerDiary(
    Long id,
    LocalDate date,
    String excerpt
) {}
