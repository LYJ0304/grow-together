package com.growtogether.report.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record ReportWorkerPeriod(
    LocalDate start,
    LocalDate end,
    @JsonProperty("end_exclusive") LocalDate endExclusive,
    @JsonProperty("as_of") OffsetDateTime asOf,
    boolean current
) {}
