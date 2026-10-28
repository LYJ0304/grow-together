package com.growtogether.agent;

import java.util.Map;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api/v1/chat-threads")
public class AgentController {
    private final AgentService service;

    public AgentController(AgentService service) { this.service = service; }

    @PostMapping
    public ResponseEntity<Map<String, UUID>> create(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.status(201).body(Map.of("threadId", service.create(Long.valueOf(jwt.getSubject()))));
    }

    @PostMapping(value = "/{threadId}/runs", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<Flux<ServerSentEvent<String>>> run(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID threadId, @Valid @RequestBody AgentRunInput input) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").header("X-Accel-Buffering", "no")
                .body(service.run(Long.valueOf(jwt.getSubject()), threadId, input));
    }
}
