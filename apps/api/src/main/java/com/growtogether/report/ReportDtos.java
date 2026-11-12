package com.growtogether.report;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;

public final class ReportDtos {
    private ReportDtos() {}
    public static final String PROMPT_VERSION = "weekly-v1";
    public record Period(LocalDate start, LocalDate end, LocalDate endExclusive,
                         OffsetDateTime asOf, boolean current) {}
    public record Daily(LocalDate date, long completed) {}
    public record Metrics(long planned, long eligible, long completed, long diaryDays,
                          Double completionRate, List<Daily> daily) {}
    public record Activity(String title, long count) {}
    public record LinkedTodo(Long id, String title) {}
    public record Memory(Long id, LocalDate date, String excerpt, List<LinkedTodo> activities,
                         boolean activitiesTruncated) {}
    public enum State { NOT_GENERATED, INSUFFICIENT_EVIDENCE, AVAILABLE, STALE, UNAVAILABLE, INVALID_RESULT }
    public record Insight(State state, String reason, Result result) {
        public static Insight of(State state, String reason) { return new Insight(state, reason, null); }
    }
    public record WeeklyReport(Period period, Metrics metrics, List<Activity> majorActivities,
            boolean activitiesTruncated, List<Memory> memories, String sourceHash,
            String promptVersion, Insight insight) {}
    public enum EvidenceType { TODO, DIARY }
    public record Evidence(@NotNull EvidenceType type, @NotNull @Positive Long id) {}
    public record Observation(@NotBlank @Size(max=300) String text,
            @NotNull @Size(min=1,max=5) List<@NotNull @Valid Evidence> evidence) {}
    public record NextStep(@NotBlank @Size(max=80) String title,
            @NotBlank @Size(max=255) String description, @NotBlank @Size(max=240) String reason,
            @NotNull @Size(min=1,max=5) List<@NotNull @Valid Evidence> evidence) {}
    public record Result(@NotBlank @Size(max=500) String summary,
            @NotNull @Size(min=1,max=3) List<@NotNull @Valid Observation> observations,
            @NotNull @Size(min=1,max=2) List<@NotNull @Valid NextStep> nextSteps) {}

    public record Child(@JsonProperty("age_months") int ageMonths,
            @JsonProperty("age_as_of") LocalDate ageAsOf,
            @JsonProperty("concern_codes") List<String> concernCodes,
            @JsonProperty("available_activity_time") String availableActivityTime) {}
    public record WorkerTodo(Long id, String title, LocalDate date, LocalTime time) {}
    public record WorkerDiary(Long id, LocalDate date, String excerpt) {}
    public record Sources(List<WorkerTodo> todos, List<WorkerDiary> diaries,
            @JsonProperty("todos_truncated") boolean todosTruncated) {}
    public record WorkerPeriod(LocalDate start, LocalDate end,
            @JsonProperty("end_exclusive") LocalDate endExclusive,
            @JsonProperty("as_of") OffsetDateTime asOf, boolean current) {}
    public record WorkerMetrics(long planned, long eligible, long completed,
            @JsonProperty("diary_days") long diaryDays,
            @JsonProperty("completion_rate") Double completionRate, List<Daily> daily) {}
    public record WorkerRequest(@JsonProperty("source_hash") String sourceHash,
            @JsonProperty("prompt_version") String promptVersion, WorkerPeriod period, WorkerMetrics metrics,
            @JsonProperty("child_context") Child childContext, Sources sources) {}
    public record WorkerResult(@NotBlank @Size(max=500) String summary,
            @NotNull @Size(min=1,max=3) List<@NotNull @Valid Observation> observations,
            @JsonProperty("next_steps") @NotNull @Size(min=1,max=2) List<@NotNull @Valid NextStep> nextSteps) {
        Result external() { return new Result(summary, observations, nextSteps); }
    }
    public record WorkerResponse(@NotBlank @JsonProperty("source_hash") String sourceHash,
            @NotBlank @JsonProperty("prompt_version") String promptVersion,
            @NotNull @Valid WorkerResult result) {}
}
