package com.growtogether.todo.dto;

import com.growtogether.todo.Todo;
import java.time.LocalDate;
import java.time.LocalTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record TodoRequest(
    @NotBlank 
    @Size(max = 80)
    String planName,
    @Size(max = 255)
    String content,
    @NotNull 
    LocalDate scheduledDate,
    @NotNull 
    LocalTime scheduledTime,
    @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(1440)
    Integer durationMinutes
) {
    public TodoRequest(String name, String content, LocalDate date, LocalTime time) {
        this(name, content, date, time, null);
    }
    public Todo toEntity(Long userId) {
        Todo todo = new Todo(userId, planName, content, scheduledDate, scheduledTime);
        todo.setDurationMinutes(durationMinutes);
        return todo;
    }
}
