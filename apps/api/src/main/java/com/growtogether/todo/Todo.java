package com.growtogether.todo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "todo")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Todo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Size(max = 80)
    @Column(name = "plan_name", nullable = false, length = 80)
    private String planName;

    @Size(max = 255)
    private String content;

    @NotNull
    @Column(name = "scheduled_date", nullable = false)
    private LocalDate scheduledDate;

    @NotNull
    @Column(name = "scheduled_time", nullable = false)
    private LocalTime scheduledTime;

    public Todo(String planName, String content, LocalDate scheduledDate, LocalTime scheduledTime) {
        this.planName = planName;
        this.content = content;
        this.scheduledDate = scheduledDate;
        this.scheduledTime = scheduledTime;
    }

    public void update(String planName, String content, LocalDate scheduledDate, LocalTime scheduledTime) {
        this.planName = planName;
        this.content = content;
        this.scheduledDate = scheduledDate;
        this.scheduledTime = scheduledTime;
    }
}
