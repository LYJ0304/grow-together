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

    @Transactional
    public void create(Long userId, TodoRequest request) {
        lockOwner(userId);
        validateDuration(request.scheduledTime(), request.durationMinutes());
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
        lockOwner(userId);
        Todo todo = findTodo(userId, id);
        Integer duration = request.durationMinutes() == null ? todo.getDurationMinutes() : request.durationMinutes();
        validateDuration(request.scheduledTime(), duration);
        todo.setDurationMinutes(duration);
        todo.update(request.planName(), request.content(), request.scheduledDate(), request.scheduledTime());
        return TodoResponse.from(todo);
    }

    @Transactional
    public TodoResponse setCompletion(Long userId, Long id, boolean completed) {
        lockOwner(userId);
        Todo todo = findTodo(userId, id);
        todo.setCompleted(completed);
        return TodoResponse.from(todo);
    }

    @Transactional
    public TodoResponse setReaction(Long userId, Long id, ChildReaction reaction) {
        // Same owner lock as completion/update: serialize state checks with writes.
        lockOwner(userId);
        Todo todo = findTodo(userId, id);
        if (!todo.isCompleted()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "완료된 일정에만 반응을 기록할 수 있어요.");
        }
        todo.setChildReaction(reaction);
        return TodoResponse.from(todo);
    }

    @Transactional
    public void deleteTodo(Long userId, Long id) {
        lockOwner(userId);
        todoRepository.delete(findTodo(userId, id));
    }

    public void lockOwner(Long userId) {
        todoRepository.lockOwner(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    public static void validateDuration(java.time.LocalTime start, Integer minutes) {
        if (minutes != null && (minutes < 1 || minutes > 1440 ||
                start.toNanoOfDay() + minutes * 60_000_000_000L > 86_400_000_000_000L))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "일정은 같은 날짜 안에 끝나야 해요.");
    }

    private Todo findTodo(Long userId, Long id) {
        return todoRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Todo not found"));
    }
}
