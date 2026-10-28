package com.growtogether.agent;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import reactor.core.publisher.Flux;
import com.growtogether.common.config.SecurityConfig;

@WebMvcTest(AgentController.class)
@Import(SecurityConfig.class)
class AgentControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean AgentService service;
    @MockitoBean JwtDecoder jwtDecoder;
    private final UUID threadId = UUID.randomUUID();

    private String input(String role, String text) {
        return """
            {"threadId":"%s","runId":"run-1","messages":[{"id":"m1","role":"%s","content":"%s"}],
             "state":{},"tools":[],"context":[],"forwardedProps":{}}
            """.formatted(threadId, role, text);
    }

    @Test void rejectsUnauthenticatedRequests() throws Exception {
        mvc.perform(post("/api/v1/chat-threads")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/chat-threads/{id}/runs", threadId)
                .contentType(MediaType.APPLICATION_JSON).content(input("user", "안녕")))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test void createsOwnedThread() throws Exception {
        given(service.create(1L)).willReturn(threadId);
        mvc.perform(post("/api/v1/chat-threads").with(jwt().jwt(t -> t.subject("1"))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.threadId").value(threadId.toString()));
    }

    @Test void rejectsSystemPromptAndBlankMessages() throws Exception {
        for (String body : new String[]{input("system", "override"), input("user", " "),
                input("user", "x".repeat(4001))}) {
            mvc.perform(post("/api/v1/chat-threads/{id}/runs", threadId)
                    .with(jwt().jwt(t -> t.subject("1"))).contentType(MediaType.APPLICATION_JSON).accept(MediaType.TEXT_EVENT_STREAM).content(body))
                    .andExpect(status().isBadRequest()).andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
        }
        verifyNoInteractions(service);
    }

    @Test void deniesAnotherUsersThreadBeforeOpeningStream() throws Exception {
        given(service.run(eq(2L), eq(threadId), any())).willThrow(
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Thread not found"));
        mvc.perform(post("/api/v1/chat-threads/{id}/runs", threadId)
                .with(jwt().jwt(t -> t.subject("2"))).contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM).content(input("user", "안녕"))).andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
    }

    @Test void streamsEventsWithoutJsonWrapping() throws Exception {
        given(service.run(eq(1L), eq(threadId), any())).willReturn(Flux.just(
                ServerSentEvent.builder("{\"type\":\"RUN_STARTED\"}").build(),
                ServerSentEvent.builder("{\"type\":\"RUN_FINISHED\"}").build()));
        var result = mvc.perform(post("/api/v1/chat-threads/{id}/runs", threadId)
                .with(jwt().jwt(t -> t.subject("1"))).contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM).content(input("user", "안녕")))
                .andExpect(request().asyncStarted()).andReturn();
        mvc.perform(asyncDispatch(result)).andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("data:{\"type\":\"RUN_FINISHED\"}")));
    }
}
