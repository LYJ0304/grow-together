package com.growtogether.report.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;
import java.util.List;

public record ReportChildContext(
    @JsonProperty("age_months") int ageMonths,
    @JsonProperty("age_as_of") LocalDate ageAsOf,
    @JsonProperty("concern_codes") List<String> concernCodes,
    @JsonProperty("available_activity_time") String availableActivityTime
) {}
