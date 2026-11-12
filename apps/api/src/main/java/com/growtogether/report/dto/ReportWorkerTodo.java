package com.growtogether.report.dto;

import java.time.LocalDate;
import java.time.LocalTime;

public record ReportWorkerTodo(
    Long id,
    String title,
    LocalDate date,
    LocalTime time
) {}
