package com.growtogether.child.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.OptBoolean;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record ChildProfileRequest(
        @NotBlank @Size(max = 50) String name,
        @NotNull @PastOrPresent
        @JsonFormat(pattern = "uuuu-MM-dd", lenient = OptBoolean.FALSE) LocalDate birthday
) {
    public ChildProfileRequest {
        if (name != null) name = name.trim();
    }

    @AssertTrue
    @JsonIgnore
    public boolean isBirthdayInSupportedRange() {
        return birthday == null || birthday.getYear() >= 1 && birthday.getYear() <= 9999;
    }
}
