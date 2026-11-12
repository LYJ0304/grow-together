package com.growtogether.report.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record ReportPeriod(
    LocalDate start,
    LocalDate end,
    LocalDate endExclusive,
    OffsetDateTime asOf,
    boolean current
) {}
