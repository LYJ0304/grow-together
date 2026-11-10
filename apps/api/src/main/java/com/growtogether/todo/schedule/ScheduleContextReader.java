package com.growtogether.todo.schedule;

import com.growtogether.child.ChildProfileRepository;
import com.growtogether.todo.TodoRepository;
import java.time.LocalDate;
import java.time.Period;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import lombok.RequiredArgsConstructor;
import static com.growtogether.todo.schedule.ScheduleDtos.*;

@Service
@RequiredArgsConstructor
public class ScheduleContextReader {
    private final TodoRepository todos;
    private final ChildProfileRepository children;

    @Transactional(readOnly=true)
    public Context read(Long userId, LocalDate date) {
        var existing = todos.findByUserIdAndScheduledDateOrderByScheduledTimeAsc(userId, date).stream().map(t -> {
            if (t.getDurationMinutes() == null)
                throw new ResponseStatusException(HttpStatus.CONFLICT, "기존 일정의 소요 시간을 먼저 입력해주세요.");
            return new Existing(t.getId(), t.getPlanName(), t.getScheduledTime(), t.getDurationMinutes());
        }).toList();
        Child child = children.findById(userId).map(p -> {
            long months = Period.between(p.getBirthday(), date).toTotalMonths();
            Integer age = !date.isBefore(p.getBirthday()) && months <= 48 ? (int) months : null;
            var personal = new Personalization(p.getPrematurityStatus(),
                    p.getExpectedDueDate() == null ? null : p.getBirthday(), p.getExpectedDueDate(),
                    List.copyOf(p.getConcerns()), p.getAvailableActivityTime(), List.of());
            return new Child(age, personal);
        }).orElse(null);
        String time = child == null ? null : child.personalization().availableActivityTime();
        Integer budget = time == null ? null : switch (time) {
            case "5min" -> 5; case "10min" -> 10; case "15to20min" -> 20; default -> null;
        };
        return new Context(existing, child, budget);
    }
}
