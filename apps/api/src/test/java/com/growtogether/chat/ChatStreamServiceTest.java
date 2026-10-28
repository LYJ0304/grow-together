package com.growtogether.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

import com.growtogether.auth.AuthRepository;
import com.growtogether.chat.client.AiWorkerClient;
import com.growtogether.chat.domain.MessageStatus;
import com.growtogether.chat.dto.ChatRequest;
import com.growtogether.chat.service.ChatService;
import com.growtogether.chat.service.ChatStreamService;
import com.growtogether.user.User;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import reactor.core.publisher.Flux;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ChatStreamServiceTest {
    @Autowired ChatService chats;
    @Autowired ChatStreamService streams;
    @Autowired AuthRepository users;
    @MockitoBean AiWorkerClient worker;
    Long userId;
    Long conversationId;

    @BeforeEach
    void setUp() {
        userId = users.saveAndFlush(new User("Stream owner", UUID.randomUUID() + "@example.com", "test-hash")).getId();
        conversationId = chats.create(userId).id();
    }

    @Test
    void streamsChunksAndSavesCompletedReply() {
        when(worker.stream(anyList())).thenReturn(Flux.just("안녕", " 세상"));
        var events = streams.stream(userId, conversationId, new ChatRequest("질문"))
                .collectList().block(Duration.ofSeconds(20));
        assertThat(events).extracting(ServerSentEvent::event).containsExactly("token", "token", "done");
        assertThat(events.getFirst().data()).isEqualTo("안녕");
        var messages = chats.messages(userId, conversationId);
        assertThat(messages).hasSize(2);
        assertThat(messages.getLast().content()).isEqualTo("안녕 세상");
        assertThat(messages.getLast().status()).isEqualTo(MessageStatus.COMPLETED);
        assertThat(events.getLast().data()).isEqualTo(messages.getLast().id().toString());
    }

    @Test
    void savesPartialReplyAndEmitsGenericErrorWhenWorkerFails() {
        when(worker.stream(anyList())).thenReturn(Flux.concat(Flux.just("부분 응답"),
                Flux.error(new IllegalStateException("private-worker-error"))));
        var events = streams.stream(userId, conversationId, new ChatRequest("질문"))
                .collectList().block(Duration.ofSeconds(20));
        assertThat(events).extracting(ServerSentEvent::event).containsExactly("token", "error");
        assertThat(events.getLast().data()).doesNotContain("private-worker-error");
        var reply = chats.messages(userId, conversationId).getLast();
        assertThat(reply.content()).isEqualTo("부분 응답");
        assertThat(reply.status()).isEqualTo(MessageStatus.FAILED);
    }

    @Test
    void emptyStreamIsAFailedReply() {
        when(worker.stream(anyList())).thenReturn(Flux.empty());
        var events = streams.stream(userId, conversationId, new ChatRequest("질문"))
                .collectList().block(Duration.ofSeconds(20));
        assertThat(events).extracting(ServerSentEvent::event).containsExactly("error");
        assertThat(chats.messages(userId, conversationId).getLast().status()).isEqualTo(MessageStatus.FAILED);
    }

    @Test
    void cancellationSavesPartialReplyAndReleasesConversation() {
        when(worker.stream(anyList())).thenReturn(Flux.concat(Flux.just("부분"), Flux.never()));
        streams.stream(userId, conversationId, new ChatRequest("질문"))
                .take(1).blockLast(Duration.ofSeconds(20));
        var reply = chats.messages(userId, conversationId).getLast();
        assertThat(reply.content()).isEqualTo("부분");
        assertThat(reply.status()).isEqualTo(MessageStatus.FAILED);
        chats.delete(userId, conversationId);
        assertThat(chats.list(userId)).isEmpty();
    }
}
