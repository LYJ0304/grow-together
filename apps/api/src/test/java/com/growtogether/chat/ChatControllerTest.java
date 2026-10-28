package com.growtogether.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.growtogether.auth.AuthRepository;
import com.growtogether.chat.client.AiWorkerClient;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Flux;
import com.growtogether.user.User;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ChatControllerTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired AuthRepository users;
    @MockitoBean AiWorkerClient worker;
    Long userId;

    @BeforeEach
    void setUp() {
        userId = users.saveAndFlush(new User("Owner", UUID.randomUUID() + "@example.com", "test-hash")).getId();
    }

    RequestPostProcessor owner() {
        return jwt().jwt(token -> token.subject(userId.toString()));
    }

    long createConversation() throws Exception {
        String json = mvc.perform(post("/api/v1/chats").with(owner()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json).get("id").asLong();
    }

    @Test
    void createsListsReadsAndDeletesOwnedConversation() throws Exception {
        long id = createConversation();
        mvc.perform(get("/api/v1/chats").with(owner()))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(id));
        mvc.perform(get("/api/v1/chats/{id}/messages", id).with(owner()))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(delete("/api/v1/chats/{id}", id).with(owner()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/chats/{id}/messages", id).with(owner()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/chats").with(owner()))
                .andExpect(content().json("[]"));
    }

    @Test
    void hidesConversationsFromOtherUsers() throws Exception {
        long id = createConversation();
        var stranger = jwt().jwt(token -> token.subject("999999"));
        mvc.perform(get("/api/v1/chats").with(stranger)).andExpect(content().json("[]"));
        mvc.perform(get("/api/v1/chats/{id}/messages", id).with(stranger)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/chats/{id}", id).with(stranger)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/chats/{id}/messages", id).with(owner())).andExpect(status().isOk());
    }

    @Test
    void sendsMessagesWithHistoryAndPersistsBothSides() throws Exception {
        long id = createConversation();
        when(worker.complete(anyList())).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return Mono.just("반가워요");
        });
        mvc.perform(post("/api/v1/chats/{id}/messages", id).with(owner())
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"안녕\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userMessage.role").value("USER"))
                .andExpect(jsonPath("$.assistantMessage.content").value("반가워요"))
                .andExpect(jsonPath("$.assistantMessage.status").value("COMPLETED"));
        mvc.perform(post("/api/v1/chats/{id}/messages", id).with(owner())
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"다음 질문\"}"))
                .andExpect(status().isCreated());
        verify(worker).complete(List.of(new AiWorkerClient.Message("user", "안녕")));
        verify(worker).complete(List.of(new AiWorkerClient.Message("user", "안녕"),
                new AiWorkerClient.Message("assistant", "반가워요"), new AiWorkerClient.Message("user", "다음 질문")));
        mvc.perform(get("/api/v1/chats/{id}/messages", id).with(owner()))
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[0].content").value("안녕"))
                .andExpect(jsonPath("$[3].status").value("COMPLETED"));
        mvc.perform(delete("/api/v1/chats/{id}", id).with(owner())).andExpect(status().isNoContent());
    }

    @Test
    void retainsUserMessageAndMarksFailedReplyWithoutLeakingWorkerErrors() throws Exception {
        long id = createConversation();
        when(worker.complete(anyList())).thenReturn(Mono.error(new IllegalStateException("secret-worker-detail")));
        mvc.perform(post("/api/v1/chats/{id}/messages", id).with(owner())
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"질문\"}"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("BAD_GATEWAY"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("secret-worker-detail"))));
        mvc.perform(get("/api/v1/chats/{id}/messages", id).with(owner()))
                .andExpect(jsonPath("$[0].status").value("COMPLETED"))
                .andExpect(jsonPath("$[1].status").value("FAILED"));
        when(worker.complete(anyList())).thenReturn(Mono.just("재시도 응답"));
        mvc.perform(post("/api/v1/chats/{id}/messages", id).with(owner())
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"다시\"}"))
                .andExpect(status().isCreated());
        verify(worker).complete(List.of(new AiWorkerClient.Message("user", "질문"), new AiWorkerClient.Message("user", "다시")));
    }

    @Test
    void rejectsInvalidMessagesAndOtherUsersBeforeCallingWorker() throws Exception {
        long id = createConversation();
        for (String body : List.of("{}", "{\"content\":null}", "{\"content\":\" \"}",
                "{\"content\":\"" + "a".repeat(10001) + "\"}", "{")) {
            mvc.perform(post("/api/v1/chats/{id}/messages", id).with(owner())
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        mvc.perform(post("/api/v1/chats/{id}/messages", id)
                .with(jwt().jwt(token -> token.subject("999999")))
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"침입\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/chats/999999/messages").with(owner())
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"질문\"}"))
                .andExpect(status().isNotFound());
        verifyNoInteractions(worker);
    }

    @Test
    void rejectsConcurrentSendAndDeleteWhileReplyIsInProgress() throws Exception {
        long id = createConversation();
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        when(worker.complete(anyList())).thenAnswer(invocation -> Mono.fromCallable(() -> {
            started.countDown();
            assertThat(release.await(20, TimeUnit.SECONDS)).isTrue();
            return "완료";
        }));
        var first = CompletableFuture.supplyAsync(() -> {
            try {
                return mvc.perform(post("/api/v1/chats/{id}/messages", id).with(owner())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"첫 질문\"}"))
                        .andReturn().getResponse().getStatus();
            } catch (Exception exception) {
                throw new RuntimeException(exception);
            }
        });
        try {
            assertThat(started.await(20, TimeUnit.SECONDS)).isTrue();
            mvc.perform(post("/api/v1/chats/{id}/messages", id).with(owner())
                    .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"중복\"}"))
                    .andExpect(status().isConflict());
            mvc.perform(delete("/api/v1/chats/{id}", id).with(owner())).andExpect(status().isConflict());
        } finally {
            release.countDown();
        }
        assertThat(first.get(20, TimeUnit.SECONDS)).isEqualTo(201);
    }

    @Test
    void streamsSseEventsAndChecksOwnershipBeforeStarting() throws Exception {
        long id = createConversation();
        when(worker.stream(anyList())).thenReturn(Flux.just("안녕", " 세상"));
        var result = mvc.perform(post("/api/v1/chats/{id}/messages/stream", id).with(owner())
                .contentType(MediaType.APPLICATION_JSON).accept(MediaType.TEXT_EVENT_STREAM)
                .content("{\"content\":\"질문\"}"))
                .andExpect(request().asyncStarted()).andReturn();
        result.getAsyncResult(20000);
        mvc.perform(asyncDispatch(result)).andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("event:token")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("event:done")));
        mvc.perform(post("/api/v1/chats/{id}/messages/stream", id)
                .with(jwt().jwt(token -> token.subject("999999")))
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"침입\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/chats/{id}/messages/stream", id).with(owner())
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\" \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsUnauthenticatedRequests() throws Exception {
        mvc.perform(post("/api/v1/chats")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/chats")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/chats/1/messages")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/chats/1/messages").contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"hello\"}")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/chats/1")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/chats/1/messages/stream").contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"hello\"}")).andExpect(status().isUnauthorized());
    }
}
