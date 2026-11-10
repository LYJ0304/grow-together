package com.growtogether.child.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record DevelopmentObservation(
        @NotBlank @Size(max = 100) String questionId,
        @NotBlank @Pattern(regexp = "yes|not_yet|unknown") String answer
) {}
