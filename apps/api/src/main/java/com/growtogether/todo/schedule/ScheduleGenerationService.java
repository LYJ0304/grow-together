package com.growtogether.todo.schedule;

import jakarta.validation.Validator;
import java.util.Comparator;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import lombok.RequiredArgsConstructor;
import static com.growtogether.todo.schedule.ScheduleDtos.*;

@Service
@RequiredArgsConstructor
public class ScheduleGenerationService {
    private final ScheduleContextReader contexts;
    private final ScheduleWorkerClient worker;
    private final Validator validator;

    // The read transaction ends before the model call; generation never saves Todos.
    public Preview generate(Long userId, GenerateRequest request) {
        var context = contexts.read(userId, request.date());
        var input = new WorkerRequest(request.date(), request.instructions() == null || request.instructions().isBlank()
                ? "아이와 함께할 부담 없는 활동을 제안해주세요." : request.instructions().trim(),
                request.availableWindows(), context.existing(), request.limit(), context.child());
        var output = worker.generate(input);
        if (output == null || !validator.validate(output).isEmpty() || !request.date().equals(output.date()))
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "일정 생성 응답을 확인하지 못했어요.");
        if (output.candidates().stream().anyMatch(c -> !request.date().equals(c.scheduledDate())))
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "일정 생성 날짜가 일치하지 않아요.");
        var candidates = output.candidates().stream().map(c -> new Candidate(c.planName().trim(), c.content(),
                c.scheduledTime(), c.durationMinutes())).sorted(Comparator.comparing(Candidate::scheduledTime)).toList();
        var unscheduled = output.unscheduled().stream().map(c -> new Unscheduled(c.planName().trim(),
                c.content(), c.durationMinutes())).toList();
        ScheduleRules.validate(candidates, unscheduled, context, request.availableWindows(), request.limit(), HttpStatus.BAD_GATEWAY);
        return new Preview(request.date(), candidates, unscheduled);
    }
}
