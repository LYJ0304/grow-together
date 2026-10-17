package com.growtogether.todo;

import org.springframework.stereotype.Service;

import com.growtogether.todo.dto.TodoRequest;
import com.growtogether.todo.dto.TodoResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

import java.util.List;
import java.time.LocalDate;

@Service 
@RequiredArgsConstructor 
public class TodoService {
    private final TodoRepository todoRepository;

    public void create(Long userId, TodoRequest request) {
        todoRepository.save(request.toEntity(userId));
    }

    public List<TodoResponse> getTodos(Long userId, LocalDate date) {
        return todoRepository.findByUserIdAndScheduledDateOrderByScheduledTimeAsc(userId, date)
                .stream().map(TodoResponse::from).toList();
    }

    public TodoResponse getTodo(Long userId, Long id) {
        return TodoResponse.from(findTodo(userId, id));
    }

    @Transactional
    public TodoResponse updateTodo(Long userId, Long id, TodoRequest request) {
        Todo todo = findTodo(userId, id);
        todo.update(request.planName(), request.content(), request.scheduledDate(), request.scheduledTime());
        return TodoResponse.from(todo);
    }

    @Transactional
    public void deleteTodo(Long userId, Long id) {
        todoRepository.delete(findTodo(userId, id));
    }

    private Todo findTodo(Long userId, Long id) {
        return todoRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Todo not found"));
    }
}
