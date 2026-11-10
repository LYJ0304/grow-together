package com.growtogether.child.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.OptBoolean;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

public record ChildPersonalization(
        @Pattern(regexp = "yes|no|unknown") String prematurityStatus,
        @JsonFormat(pattern = "uuuu-MM-dd", lenient = OptBoolean.FALSE) LocalDate expectedDueDate,
        @Size(max = 2) List<@NotNull @Pattern(regexp =
                "sleep|feeding|emotion_expression|communication|developmental_play|daily_habits|separation_anxiety|none") String> concerns,
        @Pattern(regexp = "5min|10min|15to20min|flexible") String availableActivityTime,
        @Size(max = 5) List<@NotNull @Valid DevelopmentObservation> developmentObservations
) {
    public ChildPersonalization {
        concerns = concerns == null ? List.of() : concerns.stream().toList();
        developmentObservations = developmentObservations == null
                ? List.of() : developmentObservations.stream().toList();
    }

    public static ChildPersonalization empty() {
        return new ChildPersonalization(null, null, List.of(), null, List.of());
    }

    @AssertTrue(message = "Concerns must be unique; none cannot be combined with other concerns")
    @JsonIgnore
    public boolean isConcernSelectionValid() {
        return concerns.stream().distinct().count() == concerns.size()
                && (!concerns.contains("none") || concerns.size() == 1);
    }

    @AssertTrue(message = "Expected due date requires prematurityStatus yes")
    @JsonIgnore
    public boolean isDueDateStatusValid() {
        return expectedDueDate == null || "yes".equals(prematurityStatus);
    }

    @AssertTrue(message = "No development questions are approved yet; observations must be empty")
    @JsonIgnore
    public boolean isObservationSelectionSupported() {
        // A catalog must be source-reviewed before accepting any observation IDs.
        return developmentObservations.isEmpty();
    }

    @JsonAnySetter
    public void rejectUnknownField(String name, Object value) {
        throw new IllegalArgumentException("Unknown personalization field: " + name);
    }
}
