package com.growtogether.child.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.OptBoolean;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record ChildProfileRequest(
        @NotBlank @Size(max = 50) String name,
        @NotNull @PastOrPresent
        @JsonFormat(pattern = "uuuu-MM-dd", lenient = OptBoolean.FALSE) LocalDate birthday,
        @Valid ChildPersonalization personalization
) {
    public ChildProfileRequest(String name, LocalDate birthday) {
        this(name, birthday, null);
    }

    public ChildProfileRequest {
        if (name != null) name = name.trim();
    }

    @AssertTrue
    @JsonIgnore
    public boolean isBirthdayInSupportedRange() {
        return birthday == null || birthday.getYear() >= 1 && birthday.getYear() <= 9999;
    }
    @AssertTrue(message = "Expected due date must follow birthday and use years 0001 through 9999")
    @JsonIgnore
    public boolean isExpectedDueDateValid() {
        if (personalization == null || personalization.expectedDueDate() == null) return true;
        LocalDate due = personalization.expectedDueDate();
        return due.getYear() >= 1 && due.getYear() <= 9999
                && (birthday == null || due.isAfter(birthday));
    }
}
