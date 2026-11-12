package com.growtogether.report.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ReportNextStep(
    @NotBlank @Size(max = 80) String title,
    @NotBlank @Size(max = 255) String description,
    @NotBlank @Size(max = 240) String reason,
    @NotNull @Size(min = 1, max = 5) List<@NotNull @Valid ReportEvidence> evidence
) {}
