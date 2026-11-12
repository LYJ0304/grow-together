package com.growtogether.report;

import com.growtogether.report.dto.ReportWorkerRequest;
import com.growtogether.report.dto.ReportWorkerResponse;

import java.net.http.HttpClient;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.core.JacksonException;
import tools.jackson.core.StreamReadFeature;

@Component
public class ReportWorkerClient {
    private final RestClient client;
    private final ObjectMapper mapper;
    private final String key;
    private final long readTimeoutNanos;
    @Autowired
    public ReportWorkerClient(@Value("${app.worker.base-url:http://localhost:8000}") String url,
            @Value("${app.worker.api-key:}") String key,
            @Value("${app.worker.connect-timeout-seconds:3}") int connect,
            @Value("${app.worker.read-timeout-seconds:35}") int read, ObjectMapper mapper) {
        if (connect < 1 || read <= 30 || (long) connect + read >= 45)
            throw new IllegalArgumentException("Worker timeouts must fit the existing request deadlines");
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(connect)).build());
        factory.setReadTimeout(Duration.ofSeconds(read));
        this.client = RestClient.builder().baseUrl(url).requestFactory(factory).build();
        this.key = key; this.mapper = mapper;
        this.readTimeoutNanos = Duration.ofSeconds(read).toNanos();
    }
    ReportWorkerClient(RestClient client, String key, ObjectMapper mapper, Duration readTimeout) {
        this.client = client; this.key = key; this.mapper = mapper;
        this.readTimeoutNanos = readTimeout.toNanos();
    }
    public ReportWorkerResponse generate(ReportWorkerRequest input) {
        if (key.isBlank()) throw failure(HttpStatus.SERVICE_UNAVAILABLE);
        long started = System.nanoTime();
        try {
            return client.post().uri("/internal/v1/reports/weekly/generate")
                    .header("X-API-Key", key).contentType(MediaType.APPLICATION_JSON).body(input)
                    .exchange((request, response) -> {
                        if (!response.getStatusCode().is2xxSuccessful())
                            throw failure(response.getStatusCode().value() == 504 ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.SERVICE_UNAVAILABLE);
                        var type = response.getHeaders().getContentType();
                        if (type == null || !MediaType.APPLICATION_JSON.isCompatibleWith(type))
                            throw failure(HttpStatus.BAD_GATEWAY);
                        var bytes = response.getBody().readNBytes(32 * 1024 + 1);
                        if (bytes.length > 32 * 1024) throw failure(HttpStatus.BAD_GATEWAY);
                        return mapper.readerFor(ReportWorkerResponse.class)
                                .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
                                .with(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
                                .readValue(bytes);
                    });
        } catch (ResourceAccessException ex) {
            Throwable cause = ex;
            while (cause.getCause() != null && !(cause instanceof HttpTimeoutException)) cause = cause.getCause();
            // Streaming-body deadline expiry may be reported as a generic closed-stream IOException.
            throw failure(cause instanceof HttpTimeoutException
                    || System.nanoTime() - started >= readTimeoutNanos ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.SERVICE_UNAVAILABLE);
        } catch (org.springframework.http.InvalidMediaTypeException ex) {
            throw failure(HttpStatus.BAD_GATEWAY);
        } catch (JacksonException ex) { throw failure(HttpStatus.BAD_GATEWAY);
        } catch (RestClientException ex) { throw failure(HttpStatus.SERVICE_UNAVAILABLE); }
    }

    private static ResponseStatusException failure(HttpStatus status) {
        return new ResponseStatusException(status, "Report generation unavailable");
    }

}
