package com.growtogether.report.dto;

import java.time.LocalDate;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.growtogether.todo.ChildReaction;
import java.time.LocalTime;

public record ReportWorkerTodo(
    Long id,
    String title,
    LocalDate date,
    LocalTime time,
    @JsonProperty("child_reaction") ChildReaction childReaction
) {}
