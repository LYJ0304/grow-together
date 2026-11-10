package com.growtogether.todo.schedule;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.net.http.HttpTimeoutException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import static com.growtogether.todo.schedule.ScheduleDtos.*;

@Component
public class ScheduleWorkerClient {
    private final RestClient client;
    private final String key;

    @Autowired
    public ScheduleWorkerClient(@Value("${app.worker.base-url:http://localhost:8000}") String url,
            @Value("${app.worker.api-key:}") String key,
            @Value("${app.worker.connect-timeout-seconds:3}") int connectSeconds,
            @Value("${app.worker.read-timeout-seconds:35}") int readSeconds) {
        if (connectSeconds < 1 || readSeconds <= 30 || (long) connectSeconds + readSeconds >= 45)
            throw new IllegalArgumentException("Worker timeouts must fit between model 30s and mobile 45s deadlines");
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(connectSeconds)).build());
        factory.setReadTimeout(Duration.ofSeconds(readSeconds));
        this.client = RestClient.builder().baseUrl(URI.create(url).toString()).requestFactory(factory).build();
        this.key = key;
    }
    ScheduleWorkerClient(RestClient client, String key) { this.client = client; this.key = key; }

    public WorkerResponse generate(WorkerRequest request) {
        if (key.isBlank()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "일정 생성 연결이 설정되지 않았어요.");
        try {
            return client.post().uri("/internal/v1/schedule/generate")
                    .header("X-API-Key", key).contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .body(request).retrieve().body(WorkerResponse.class);
        } catch (RestClientResponseException ex) {
            throw new ResponseStatusException(ex.getStatusCode().value() == 504 ? HttpStatus.GATEWAY_TIMEOUT
                    : HttpStatus.BAD_GATEWAY, "일정을 생성하지 못했어요.");
        } catch (ResourceAccessException ex) {
            Throwable cause = ex;
            while (cause.getCause() != null && !(cause instanceof HttpTimeoutException)) cause = cause.getCause();
            throw new ResponseStatusException(cause instanceof HttpTimeoutException
                    ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.SERVICE_UNAVAILABLE, "일정 생성 서버에 연결하지 못했어요.");
        } catch (RestClientException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "일정 생성 응답을 확인하지 못했어요.");
        }
    }
}
