package com.growtogether.agent;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;
import io.netty.channel.ChannelOption;
import reactor.core.publisher.Flux;
import reactor.netty.http.client.HttpClient;

@Service
public class AgentService {
    private final ChatThreadRepository threads;
    private final WebClient worker;
    private final String workerToken;

    public AgentService(ChatThreadRepository threads, @Value("${app.worker.url:http://localhost:8000}") String url,
            @Value("${app.worker.token:}") String token) {
        this.threads = threads;
        this.workerToken = token;
        this.worker = WebClient.builder().baseUrl(url)
                .clientConnector(new ReactorClientHttpConnector(HttpClient.create()
                        .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000)
                        .responseTimeout(Duration.ofSeconds(30))))
                .build();
    }

    public UUID create(Long userId) {
        return threads.saveAndFlush(new ChatThread(userId)).getId();
    }

    public Flux<ServerSentEvent<String>> run(Long userId, UUID threadId, AgentRunInput input) {
        if (!threads.existsByIdAndUserId(threadId, userId))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Thread not found");
        if (!threadId.toString().equals(input.threadId())
                || !"user".equals(input.messages().getLast().role()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid thread or final message");
        if (workerToken.isBlank())
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Worker is not configured");
        Flux<ServerSentEvent<String>> events = worker.post().uri("/agent/run")
                .header("X-Worker-Token", workerToken)
                .contentType(MediaType.APPLICATION_JSON).accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(Map.of("threadId", input.threadId(), "runId", input.runId(),
                        "messages", input.messages(), "state", Map.of(), "tools", java.util.List.of(),
                        "context", java.util.List.of()))
                .retrieve().bodyToFlux(new ParameterizedTypeReference<ServerSentEvent<String>>() { })
                .timeout(Duration.ofSeconds(35))
                .take(Duration.ofSeconds(125))
                .onErrorReturn(ServerSentEvent.builder(
                        "{\"type\":\"RUN_ERROR\",\"code\":\"WORKER_ERROR\","
                        + "\"message\":\"상담 서버 연결을 확인해주세요.\"}").build());
        // Heartbeats let MVC observe a disconnected client even while the model is silent.
        return events.publish(shared -> Flux.merge(shared,
                Flux.interval(Duration.ofSeconds(5))
                        .map(tick -> ServerSentEvent.<String>builder().comment("keep-alive").build())
                        .takeUntilOther(shared.ignoreElements())));
    }
}
