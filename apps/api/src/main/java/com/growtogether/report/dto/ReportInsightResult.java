package com.growtogether.report.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ReportInsightResult(
    @NotBlank @Size(max = 500) String summary,
    @NotNull @Size(min = 1, max = 3) List<@NotNull @Valid ReportObservation> observations,
    @NotNull @Size(min = 1, max = 2) List<@NotNull @Valid ReportNextStep> nextSteps
) {}
