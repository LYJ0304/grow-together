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

    public void create(TodoRequest request) {
        todoRepository.save(request.toEntity());
    }

    public List<TodoResponse> getTodos(LocalDate date) {
        return todoRepository.findByScheduledDateOrderByScheduledTimeAsc(date)
                .stream().map(TodoResponse::from).toList();
    }

    public TodoResponse getTodo(Long id) {
        return TodoResponse.from(findTodo(id));
    }

    @Transactional
    public TodoResponse updateTodo(Long id, TodoRequest request) {
        Todo todo = findTodo(id);
        todo.update(request.planName(), request.content(), request.scheduledDate(), request.scheduledTime());
        return TodoResponse.from(todo);
    }

    @Transactional
    public void deleteTodo(Long id) {
        todoRepository.delete(findTodo(id));
    }

    private Todo findTodo(Long id) {
        return todoRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Todo not found"));
    }
}
