package com.growtogether.chat;

import java.net.http.HttpClient;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

@Component
public class ChatWorkerClient {
    private final RestClient client;
    private final String key;

    @Autowired
    public ChatWorkerClient(@Value("${app.worker.base-url:http://localhost:8000}") String url,
            @Value("${app.worker.api-key:}") String key,
            @Value("${app.worker.connect-timeout-seconds:3}") int connectSeconds,
            @Value("${app.worker.read-timeout-seconds:35}") int readSeconds) {
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(connectSeconds)).build());
        factory.setReadTimeout(Duration.ofSeconds(readSeconds));
        this.client = RestClient.builder().baseUrl(url).requestFactory(factory).build();
        this.key = key;
    }

    ChatWorkerClient(RestClient client, String key) {
        this.client = client;
        this.key = key;
    }

    public ChatController.Reply generate(ChatController.Question question) {
        if (key.isBlank()) throw failure(HttpStatus.SERVICE_UNAVAILABLE);
        try {
            var reply = client.post().uri("/internal/v1/chat/generate")
                    .header("X-API-Key", key).contentType(MediaType.APPLICATION_JSON)
                    .body(question).retrieve().body(ChatController.Reply.class);
            if (reply == null || reply.content() == null || reply.content().isBlank()) {
                throw failure(HttpStatus.BAD_GATEWAY);
            }
            return reply;
        } catch (RestClientResponseException ex) {
            throw failure(ex.getStatusCode().value() == 504 ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.BAD_GATEWAY);
        } catch (ResourceAccessException ex) {
            Throwable cause = ex;
            while (cause.getCause() != null && !(cause instanceof HttpTimeoutException)) {
                cause = cause.getCause();
            }
            throw failure(cause instanceof HttpTimeoutException ? HttpStatus.GATEWAY_TIMEOUT
                    : HttpStatus.SERVICE_UNAVAILABLE);
        } catch (RestClientException ex) {
            throw failure(HttpStatus.BAD_GATEWAY);
        }
    }

    private static ResponseStatusException failure(HttpStatus status) {
        return new ResponseStatusException(status, "Chat reply unavailable");
    }
}
