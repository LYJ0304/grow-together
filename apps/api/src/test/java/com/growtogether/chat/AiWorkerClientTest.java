package com.growtogether.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.growtogether.chat.client.AiWorkerClient;
import com.growtogether.common.config.WebClientConfig;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import tools.jackson.databind.ObjectMapper;

class AiWorkerClientTest {
    HttpServer server;
    AiWorkerClient client;
    WebClient webClient;
    List<AiWorkerClient.Message> history = List.of(new AiWorkerClient.Message("user", "안녕"));

    @BeforeEach
    void setUp() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.start();
        webClient = new WebClientConfig().aiWorkerWebClient(
                "http://127.0.0.1:" + server.getAddress().getPort(), "test-worker-key",
                Duration.ofSeconds(5), Duration.ofSeconds(15));
        client = new AiWorkerClient(webClient, Duration.ofSeconds(15));
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void postsConversationHistoryAndReadsReply() {
        AtomicReference<String> request = new AtomicReference<>();
        AtomicReference<String> key = new AtomicReference<>();
        server.createContext("/v1/chat", exchange -> {
            request.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            key.set(exchange.getRequestHeaders().getFirst("X-API-Key"));
            assertThat(exchange.getRequestMethod()).isEqualTo("POST");
            byte[] body = "{\"content\":\"반가워요\"}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        assertThat(client.complete(history).block()).isEqualTo("반가워요");
        assertThat(new ObjectMapper().readTree(request.get()).get("messages").get(0).get("content").asString())
                .isEqualTo("안녕");
        assertThat(key.get()).isEqualTo("test-worker-key");
    }

    @Test
    void streamsTextChunksWithoutLosingSpaces() {
        server.createContext("/v1/chat/stream", exchange -> {
            byte[] body = "data: 안녕\n\ndata:  세상\n\n".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "text/event-stream");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        assertThat(client.stream(history).collectList().block()).containsExactly("안녕", " 세상");
    }

    @Test
    void rejectsHttpFailureAndBlankOrMissingReplies() {
        server.createContext("/v1/chat", exchange -> {
            exchange.sendResponseHeaders(503, -1);
            exchange.close();
        });
        assertThatThrownBy(() -> client.complete(history).block()).hasMessageContaining("503");
        server.removeContext("/v1/chat");
        for (String reply : List.of("{\"content\":\" \"}", "{}", "")) {
            server.createContext("/v1/chat", exchange -> {
                byte[] body = reply.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
                exchange.close();
            });
            assertThatThrownBy(() -> client.complete(history).block()).isInstanceOf(RuntimeException.class);
            server.removeContext("/v1/chat");
        }
    }

    @Test
    void timesOutWhenWorkerDoesNotRespond() {
        client = new AiWorkerClient(webClient, Duration.ofMillis(100));
        server.createContext("/v1/chat", exchange -> { });
        assertThatThrownBy(() -> client.complete(history).block()).hasMessageContaining("TimeoutException");
    }
}
