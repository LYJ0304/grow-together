package com.growtogether.report.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ReportWorkerResponse(
    @NotBlank @JsonProperty("source_hash") String sourceHash,
    @NotBlank @JsonProperty("prompt_version") String promptVersion,
    @NotNull @Valid ReportWorkerResult result
) {}
