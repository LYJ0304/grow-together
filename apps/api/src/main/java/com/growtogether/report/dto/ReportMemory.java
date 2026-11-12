package com.growtogether.report.dto;

import java.time.LocalDate;
import java.util.List;

public record ReportMemory(
    Long id,
    LocalDate date,
    String excerpt,
    List<ReportLinkedTodo> activities,
    boolean activitiesTruncated
) {}
