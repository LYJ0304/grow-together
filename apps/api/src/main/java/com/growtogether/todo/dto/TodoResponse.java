package com.growtogether.todo.dto;

import com.growtogether.todo.Todo;
import java.time.LocalDate;
import java.time.LocalTime;

public record TodoResponse(
    Long id,
    String planName,
    String content,
    LocalDate scheduledDate,
    LocalTime scheduledTime
) {
    public static TodoResponse from(Todo todo) {
        return new TodoResponse(todo.getId(), todo.getPlanName(), todo.getContent(),
                todo.getScheduledDate(), todo.getScheduledTime());
    }
}
