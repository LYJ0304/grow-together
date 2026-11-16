package com.growtogether.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateUserProfileRequest(
        @NotBlank @Size(max = 50) @Pattern(regexp = "(?sU).*[^\\s\\uFEFF].*") String name) {
}
