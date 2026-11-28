package com.growtogether.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record WithdrawalRequest(@NotBlank @Size(max = 72) String password) {
    @Override public String toString() { return "WithdrawalRequest[REDACTED]"; }
}
