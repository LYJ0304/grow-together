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
    String content,
    @NotNull 
    LocalDate scheduledDate,
    @NotNull 
    LocalTime scheduledTime
) {
    public Todo toEntity() {
        return new Todo(planName, content, scheduledDate, scheduledTime);
    }
}
