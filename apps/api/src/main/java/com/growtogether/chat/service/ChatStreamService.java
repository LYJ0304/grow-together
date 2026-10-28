package com.growtogether.chat.service;

import com.growtogether.chat.client.AiWorkerClient;
import com.growtogether.chat.dto.ChatRequest;
import com.growtogether.chat.dto.ChatResponse;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.RequiredArgsConstructor;
import org.springframework.http.codec.ServerSentEvent;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.SignalType;
import reactor.core.scheduler.Schedulers;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class ChatStreamService {
    private final ChatService chatService;
    private final AiWorkerClient worker;

    public Flux<ServerSentEvent<String>> stream(Long userId, Long id, ChatRequest request) {
        ChatService.PendingTurn turn = chatService.beginTurn(userId, id, request.content());
        StringBuffer content = new StringBuffer();
        AtomicBoolean terminated = new AtomicBoolean();
        return Flux.defer(() -> worker.stream(turn.history()))
                .publishOn(Schedulers.boundedElastic())
                .map(chunk -> {
                    content.append(chunk);
                    return event("token", chunk);
                })
                .concatWith(Mono.fromCallable(() -> {
                    String reply = content.toString();
                    if (reply.isBlank()) {
                        throw new IllegalStateException("Worker returned an empty reply");
                    }
                    ChatResponse.Message saved = chatService.complete(turn.assistantId(), reply);
                    terminated.set(true);
                    return event("done", saved.id().toString());
                }))
                .onErrorResume(exception -> {
                    if (terminated.compareAndSet(false, true)) {
                        chatService.fail(turn.assistantId(), content.toString());
                    }
                    return Mono.just(event("error", "AI worker request failed"));
                })
                .doFinally(signal -> {
                    if (signal == SignalType.CANCEL && terminated.compareAndSet(false, true)) {
                        chatService.fail(turn.assistantId(), content.toString());
                    }
                });
    }

    private ServerSentEvent<String> event(String name, String data) {
        return ServerSentEvent.<String>builder(data).event(name).build();
    }

    public ChatResponse.Turn send(Long userId, Long id, ChatRequest request) {
        ChatService.PendingTurn turn = chatService.beginTurn(userId, id, request.content());
        try {
            String content = worker.complete(turn.history()).block();
            if (content == null || content.isBlank()) {
                throw new IllegalStateException("Worker returned an empty reply");
            }
            return new ChatResponse.Turn(turn.userMessage(), chatService.complete(turn.assistantId(), content));
        } catch (RuntimeException exception) {
            chatService.fail(turn.assistantId(), "");
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI worker request failed");
        }
    }
}
