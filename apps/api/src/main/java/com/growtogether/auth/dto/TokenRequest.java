package com.growtogether.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TokenRequest(@NotBlank @Size(max = 200) String refreshToken) {
    @Override public String toString() { return "TokenRequest[redacted]"; }
}
