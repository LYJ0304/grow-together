package com.growtogether.report.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ReportObservation(
    @NotBlank @Size(max = 300) String text,
    @NotNull @Size(min = 1, max = 5) List<@NotNull @Valid ReportEvidence> evidence
) {}
