package com.growtogether.chat;

import com.growtogether.chat.dto.ChatResponse;
import com.growtogether.chat.dto.ChatRequest;
import com.growtogether.chat.service.ChatStreamService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import reactor.core.publisher.Flux;
import com.growtogether.chat.service.ChatService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/chats")
@RequiredArgsConstructor
public class ChatController {
    private final ChatService chatService;
    private final ChatStreamService chatStreamService;

    @PostMapping
    public ResponseEntity<ChatResponse> createChat(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.status(HttpStatus.CREATED).body(chatService.create(Long.valueOf(jwt.getSubject())));
    }

    @GetMapping
    public List<ChatResponse> getChat(@AuthenticationPrincipal Jwt jwt) {
        return chatService.list(Long.valueOf(jwt.getSubject()));
    }

    @GetMapping("/{id}/messages")
    public List<ChatResponse.Message> getChatMessage(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return chatService.messages(Long.valueOf(jwt.getSubject()), id);
    }

    @PostMapping("/{id}/messages")
    public ResponseEntity<ChatResponse.Turn> createChatMessage(@AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id, @Valid @RequestBody ChatRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(chatStreamService.send(Long.valueOf(jwt.getSubject()), id, request));
    }

    @PostMapping(value = "/{id}/messages/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> streamChatMessage(@AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id, @Valid @RequestBody ChatRequest request) {
        return chatStreamService.stream(Long.valueOf(jwt.getSubject()), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteChat(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        chatService.delete(Long.valueOf(jwt.getSubject()), id);
        return ResponseEntity.noContent().build();
    }
}
