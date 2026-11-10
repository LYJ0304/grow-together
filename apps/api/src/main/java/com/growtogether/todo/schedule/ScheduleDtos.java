package com.growtogether.todo.schedule;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public final class ScheduleDtos {
    private ScheduleDtos() {}
    public record Window(@NotNull LocalTime start, @NotNull LocalTime end) {
        @com.fasterxml.jackson.annotation.JsonIgnore
        @AssertTrue public boolean isOrdered() { return start == null || end == null || start.isBefore(end); }
    }
    public record GenerateRequest(@NotNull LocalDate date, @Size(max=1000) String instructions,
            @NotNull @Size(min=1,max=10) List<@NotNull @Valid Window> availableWindows,
            @Min(1) @Max(10) Integer maxCandidates) {
        public int limit() { return maxCandidates == null ? 5 : maxCandidates; }
    }
    public record Candidate(@NotBlank @Size(max=80) String planName, @Size(max=255) String content,
            @NotNull LocalTime scheduledTime, @NotNull @Min(1) @Max(1440) Integer durationMinutes) {}
    public record Unscheduled(String planName, String content, int durationMinutes) {}
    public record Preview(LocalDate date, List<Candidate> candidates, List<Unscheduled> unscheduled) {}
    public record BatchRequest(@NotNull LocalDate date,
            @NotNull @Size(min=1,max=10) List<@NotNull @Valid Candidate> candidates) {}

    public record Personalization(
            @JsonProperty("prematurity_status") String prematurityStatus,
            LocalDate birthday,
            @JsonProperty("expected_due_date") LocalDate expectedDueDate,
            @JsonProperty("concern_codes") List<String> concernCodes,
            @JsonProperty("available_activity_time") String availableActivityTime,
            @JsonProperty("development_observations") List<Object> observations) {}
    public record Child(@JsonProperty("age_months") Integer ageMonths, Personalization personalization) {}
    public record Existing(@JsonProperty("todo_id") Long todoId,
            @JsonProperty("plan_name") String planName, LocalTime start,
            @JsonProperty("duration_minutes") int durationMinutes) {}
    public record WorkerRequest(LocalDate date, String instructions,
            @JsonProperty("available_windows") List<Window> availableWindows,
            @JsonProperty("existing_schedules") List<Existing> existingSchedules,
            @JsonProperty("max_candidates") int maxCandidates,
            @JsonProperty("child_context") Child childContext) {}
    public record WorkerCandidate(@NotBlank @Size(max=80) @JsonProperty("plan_name") String planName,
            @Size(max=255) String content, @NotNull @JsonProperty("scheduled_date") LocalDate scheduledDate,
            @NotNull @JsonProperty("scheduled_time") LocalTime scheduledTime,
            @NotNull @Min(1) @Max(1440) @JsonProperty("duration_minutes") Integer durationMinutes) {}
    public record WorkerProposal(@NotBlank @Size(max=80) @JsonProperty("plan_name") String planName,
            @Size(max=255) String content,
            @NotNull @Min(1) @Max(1440) @JsonProperty("duration_minutes") Integer durationMinutes) {}
    public record WorkerResponse(@NotNull LocalDate date,
            @NotNull @Size(max=10) List<@NotNull @Valid WorkerCandidate> candidates,
            @NotNull @Size(max=10) List<@NotNull @Valid WorkerProposal> unscheduled) {}
    public record Context(List<Existing> existing, Child child, Integer budget) {}
}
