package com.growtogether.report;

import org.springframework.web.server.ResponseStatusException;

import org.springframework.http.HttpStatus;

import com.growtogether.report.dto.ReportWorkerRequest;

import static org.assertj.core.api.Assertions.*;
import static com.growtogether.report.ReportTestData.*;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.json.JsonMapper;

class ReportWorkerClientTest {
    final JsonMapper mapper=JsonMapper.builder().build();
    final ReportWorkerRequest input=snapshot("a".repeat(64)).input();
    HttpServer server;
    final AtomicReference<String> body=new AtomicReference<>();
    final AtomicReference<String> received=new AtomicReference<>();
    final AtomicReference<String> key=new AtomicReference<>();
    java.util.concurrent.CountDownLatch holdBody;
    int status=200;
    String contentType="application/json";
    @BeforeEach void start() throws Exception {
        body.set(mapper.writeValueAsString(result(input)));
        server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/internal/v1/reports/weekly/generate",exchange->{
            received.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
            key.set(exchange.getRequestHeaders().getFirst("X-API-Key"));
            var bytes=body.get().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type",contentType);
            exchange.sendResponseHeaders(status,bytes.length);
            if (holdBody != null) {
                try { holdBody.await(5,java.util.concurrent.TimeUnit.SECONDS); }
                catch(InterruptedException ex) { Thread.currentThread().interrupt(); }
            }
            try { exchange.getResponseBody().write(bytes); } finally { exchange.close(); }
        });server.start();
    }
    @AfterEach void stop() { server.stop(0); }
    ReportWorkerClient client(String key) {return new ReportWorkerClient("http://127.0.0.1:"+server.getAddress().getPort(),key,3,35,mapper);}
    @Test void sendsMinimalSnakeCasePayloadAndParsesStrictResponse() {
        assertThat(client("test-internal-key").generate(input)).isEqualTo(result(input));
        var json=mapper.readTree(received.get());
        assertThat(key.get()).isEqualTo("test-internal-key");
        assertThat(json.at("/source_hash").asText()).isEqualTo(input.sourceHash());
        assertThat(json.at("/period/end_exclusive").asText()).isEqualTo(WEEK.plusDays(7).toString());
        assertThat(json.at("/metrics/diary_days").asInt()).isZero();
        assertThat(json.at("/child_context/age_months").asInt()).isEqualTo(22);
        assertThat(received.get()).doesNotContain("birthday","name","image","user_id","prematurity","completionRate","diaryDays");
    }
    @ParameterizedTest @ValueSource(strings={"{}","null","{broken","{\"unknown\":true}","{} {}","{\"source_hash\":\"a\",\"source_hash\":\"b\"}"})
    void malformedOrUnknownShapeIsRejected(String invalid) {
        body.set(invalid);
        if("{}".equals(invalid)) {
            // Missing fields are rejected by the result validator after deserialization.
            assertThat(new ReportResultValidator(jakarta.validation.Validation.buildDefaultValidatorFactory().getValidator())
                    .valid(input,client("test").generate(input))).isFalse();
        } else if("null".equals(invalid)) {
            assertThat(client("test").generate(input)).isNull();
        } else assertThatThrownBy(()->client("test").generate(input)).isInstanceOf(ResponseStatusException.class);
    }
    @Test void responseBodyLimitAndWorkerStatusAreSanitized() {
        body.set("x".repeat(32769));
        assertThatThrownBy(()->client("test").generate(input)).isInstanceOfSatisfying(ResponseStatusException.class,
                e->assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY));
        status=504;body.set("private provider error");
        assertThatThrownBy(()->client("test").generate(input)).isInstanceOfSatisfying(ResponseStatusException.class,
                e->{assertThat(e.getStatusCode()).isEqualTo(HttpStatus.GATEWAY_TIMEOUT);assertThat(e.getMessage()).doesNotContain("private");});
        status=500;
        assertThatThrownBy(()->client("test").generate(input)).isInstanceOfSatisfying(ResponseStatusException.class,
                e->assertThat(e.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }
    @Test void missingKeyDoesNotSendARequest() {
        assertThatThrownBy(()->client("").generate(input)).isInstanceOf(ResponseStatusException.class);
        assertThat(received.get()).isNull();
    }
    @Test void invalidMediaTypeIsAnInvalidResultRatherThanAnUnhandledError() {
        contentType="not a media type";
        assertThatThrownBy(()->client("test").generate(input)).isInstanceOfSatisfying(ResponseStatusException.class,
                e->assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test void stalledResponseBodyHonorsDeadlineAndReportsTimeout() {
        holdBody=new java.util.concurrent.CountDownLatch(1);
        var factory=new org.springframework.http.client.JdkClientHttpRequestFactory(java.net.http.HttpClient.newHttpClient());
        factory.setReadTimeout(java.time.Duration.ofMillis(150));
        var rest=org.springframework.web.client.RestClient.builder().baseUrl("http://127.0.0.1:"+server.getAddress().getPort()).requestFactory(factory).build();
        var client=new ReportWorkerClient(rest,"test",mapper,java.time.Duration.ofMillis(150));
        try {
            org.junit.jupiter.api.Assertions.assertTimeoutPreemptively(java.time.Duration.ofSeconds(2),()->
                assertThatThrownBy(()->client.generate(input)).isInstanceOfSatisfying(ResponseStatusException.class,
                    e->assertThat(e.getStatusCode()).isEqualTo(HttpStatus.GATEWAY_TIMEOUT)));
        } finally { holdBody.countDown(); }
    }

}
