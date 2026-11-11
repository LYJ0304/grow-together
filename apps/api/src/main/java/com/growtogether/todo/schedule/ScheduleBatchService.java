package com.growtogether.todo.schedule;

import com.growtogether.todo.Todo;
import com.growtogether.todo.TodoRepository;
import com.growtogether.todo.TodoService;
import com.growtogether.todo.dto.TodoResponse;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import static com.growtogether.todo.schedule.ScheduleDtos.*;

@Service
@RequiredArgsConstructor
public class ScheduleBatchService {
    private final TodoService todos;
    private final TodoRepository repository;
    private final ScheduleContextReader contexts;

    @Transactional
    public List<TodoResponse> save(Long userId, BatchRequest request) {
        // All Todo create/update/delete operations lock this same owner row.
        todos.lockOwner(userId);
        var current = contexts.read(userId, request.date());
        ScheduleRules.validate(request.candidates(), List.of(), current, null, 10, HttpStatus.CONFLICT);
        var added = request.candidates().stream().map(c -> {
            var todo = new Todo(userId, c.planName().trim(), c.content(), request.date(), c.scheduledTime());
            todo.setDurationMinutes(c.durationMinutes());
            return todo;
        }).toList();
        return repository.saveAllAndFlush(added).stream().map(TodoResponse::from)
                .sorted(java.util.Comparator.comparing(TodoResponse::scheduledTime)).toList();
    }
}
