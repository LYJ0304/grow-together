package com.growtogether.todo.dto;

import com.growtogether.todo.Todo;
import com.growtogether.todo.ChildReaction;
import java.time.LocalDate;
import java.time.LocalTime;

public record TodoResponse(
    Long id,
    String planName,
    String content,
    LocalDate scheduledDate,
    LocalTime scheduledTime,
    boolean completed,
    Integer durationMinutes,
    ChildReaction childReaction
) {
    public static TodoResponse from(Todo todo) {
        return new TodoResponse(todo.getId(), todo.getPlanName(), todo.getContent(),
                todo.getScheduledDate(), todo.getScheduledTime(), todo.isCompleted(), todo.getDurationMinutes(), todo.getChildReaction());
    }
}
