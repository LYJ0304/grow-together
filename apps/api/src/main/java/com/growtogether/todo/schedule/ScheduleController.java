package com.growtogether.todo.schedule;

import com.growtogether.todo.dto.TodoResponse;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import static com.growtogether.todo.schedule.ScheduleDtos.*;

@RestController
@RequestMapping("/api/v1/todos")
@RequiredArgsConstructor
public class ScheduleController {
    private final ScheduleGenerationService generation;
    private final ScheduleBatchService batches;
    @PostMapping("/generate")
    public Preview generate(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody GenerateRequest request) {
        return generation.generate(Long.valueOf(jwt.getSubject()), request);
    }
    @PostMapping("/batch")
    @ResponseStatus(HttpStatus.CREATED)
    public List<TodoResponse> save(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody BatchRequest request) {
        return batches.save(Long.valueOf(jwt.getSubject()), request);
    }
}
