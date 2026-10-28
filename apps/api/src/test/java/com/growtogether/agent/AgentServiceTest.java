package com.growtogether.agent;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class AgentServiceTest {
    private final ChatThreadRepository threads = mock(ChatThreadRepository.class);
    private final UUID id = UUID.randomUUID();
    private AgentRunInput input(String thread) {
        return new AgentRunInput(thread, "run-1",
                List.of(new AgentRunInput.TextMessage("m1", "user", "질문")), Map.of(), List.of(), List.of(), null, null);
    }

    @Test void checksOwnerAndThreadBeforeContactingWorker() {
        var service = new AgentService(threads, "http://127.0.0.1:1", "test-token");
        assertThatThrownBy(() -> service.run(2L, id, input(id.toString())))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode().value()).isEqualTo(404));
        when(threads.existsByIdAndUserId(id, 1L)).thenReturn(true);
        assertThatThrownBy(() -> service.run(1L, id, input(UUID.randomUUID().toString())))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode().value()).isEqualTo(400));
    }

    @Test void doesNotBufferResponseUntilWorkerCompletes() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var release = new CountDownLatch(1);
        var authenticated = new CountDownLatch(1);
        server.createContext("/agent/run", exchange -> {
            try {
                if ("test-token".equals(exchange.getRequestHeaders().getFirst("X-Worker-Token"))) authenticated.countDown();
                exchange.getResponseHeaders().set("Content-Type", "text/event-stream");
                exchange.sendResponseHeaders(200, 0);
                exchange.getResponseBody().write("data: {\"type\":\"RUN_STARTED\"}\n\n".getBytes(StandardCharsets.UTF_8));
                exchange.getResponseBody().flush();
                release.await(10, TimeUnit.SECONDS);
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { exchange.close(); }
        });
        server.start();
        try {
            when(threads.existsByIdAndUserId(id, 1L)).thenReturn(true);
            var service = new AgentService(threads, "http://127.0.0.1:" + server.getAddress().getPort(), "test-token");
            var first = service.run(1L, id, input(id.toString())).next().block(Duration.ofSeconds(5));
            assertThat(first.data()).contains("RUN_STARTED");
            assertThat(authenticated.getCount()).isZero();
            assertThat(release.getCount()).isEqualTo(1);
        } finally { release.countDown(); server.stop(0); }
    }

    @Test void sanitizesWorkerConnectionFailure() {
        when(threads.existsByIdAndUserId(id, 1L)).thenReturn(true);
        var service = new AgentService(threads, "http://127.0.0.1:1", "private-test-token");
        var events = service.run(1L, id, input(id.toString())).collectList().block(Duration.ofSeconds(10));
        assertThat(events).hasSize(1);
        assertThat(events.getFirst().data()).contains("RUN_ERROR").doesNotContain("private-test-token");
    }
}
