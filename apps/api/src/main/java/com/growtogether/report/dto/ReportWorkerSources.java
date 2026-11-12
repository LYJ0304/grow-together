package com.growtogether.report.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record ReportWorkerSources(
    List<ReportWorkerTodo> todos,
    List<ReportWorkerDiary> diaries,
    @JsonProperty("todos_truncated") boolean todosTruncated
) {}
