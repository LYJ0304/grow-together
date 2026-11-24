package com.growtogether.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.net.ConnectException;
import java.net.http.HttpTimeoutException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

class ChatWorkerClientTest {
    private static final String URL = "http://worker/internal/v1/chat/generate";
    private final RestClient.Builder builder = RestClient.builder().baseUrl("http://worker");
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final ChatController.Question question = new ChatController.Question("Play?", null);

    @Test
    void forwardsQuestionAndReturnsOnlyReplyContent() {
        server.expect(requestTo(URL)).andExpect(header("X-API-Key", "test-key"))
                .andExpect(jsonPath("$.message").value("Play?"))
                .andExpect(jsonPath("$.history").isEmpty())
                .andRespond(withSuccess("""
                        {"content":"Read together.","model":"openrouter/free","input_token":null,"output_tokens":null}
                        """, MediaType.APPLICATION_JSON));
        assertThat(new ChatWorkerClient(builder.build(), "test-key").generate(question).content())
                .isEqualTo("Read together.");
        server.verify();
    }

    @Test
    void mapsWorkerTimeoutWithoutExposingProviderDetails() {
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.GATEWAY_TIMEOUT).body("provider details"));
        assertFailure(new ChatWorkerClient(builder.build(), "test-key"), HttpStatus.GATEWAY_TIMEOUT);
        server.verify();
    }

    @Test
    void mapsNetworkTimeout() {
        server.expect(requestTo(URL)).andRespond(withException(new HttpTimeoutException("provider details")));
        assertFailure(new ChatWorkerClient(builder.build(), "test-key"), HttpStatus.GATEWAY_TIMEOUT);
        server.verify();
    }

    @Test
    void mapsUnreachableWorker() {
        server.expect(requestTo(URL)).andRespond(withException(new ConnectException("provider details")));
        assertFailure(new ChatWorkerClient(builder.build(), "test-key"), HttpStatus.SERVICE_UNAVAILABLE);
        server.verify();
    }

    @Test
    void rejectsInvalidReply() {
        server.expect(requestTo(URL)).andRespond(withSuccess("{\"content\":\" \"}", MediaType.APPLICATION_JSON));
        assertFailure(new ChatWorkerClient(builder.build(), "test-key"), HttpStatus.BAD_GATEWAY);
        server.verify();
    }

    private void assertFailure(ChatWorkerClient client, HttpStatus status) {
        assertThatThrownBy(() -> client.generate(question)).isInstanceOfSatisfying(ResponseStatusException.class,
                error -> {
                    assertThat(error.getStatusCode()).isEqualTo(status);
                    assertThat(error.getReason()).doesNotContain("provider details");
                });
    }
}
