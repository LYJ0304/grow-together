package com.growtogether.report.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ReportEvidence(
    @NotNull ReportEvidenceType type,
    @NotNull @Positive Long id
) {}
