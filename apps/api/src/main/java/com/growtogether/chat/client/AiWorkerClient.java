package com.growtogether.chat.client;

import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Component
public class AiWorkerClient {
    private final WebClient webClient;
    private final Duration responseTimeout;

    public AiWorkerClient(@Qualifier("aiWorkerWebClient") WebClient webClient,
            @Value("${ai.worker.response-timeout:120s}") Duration responseTimeout) {
        this.webClient = webClient;
        this.responseTimeout = responseTimeout;
    }

    public Mono<String> complete(List<Message> messages) {
        return webClient.post().uri("/v1/chat").contentType(MediaType.APPLICATION_JSON)
                .bodyValue(new Request(messages)).retrieve().bodyToMono(Reply.class)
                .filter(reply -> reply.content() != null && !reply.content().isBlank())
                .map(Reply::content)
                .switchIfEmpty(Mono.error(new IllegalStateException("Worker returned an empty reply")))
                .timeout(responseTimeout);
    }

    public Flux<String> stream(List<Message> messages) {
        return webClient.post().uri("/v1/chat/stream").contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM).bodyValue(new Request(messages)).retrieve()
                .bodyToFlux(new ParameterizedTypeReference<ServerSentEvent<String>>() { })
                .filter(event -> event.data() != null).map(ServerSentEvent::data)
                .timeout(responseTimeout);
    }

    public record Message(String role, String content) { }
    private record Request(List<Message> messages) { }
    private record Reply(String content) { }
}
