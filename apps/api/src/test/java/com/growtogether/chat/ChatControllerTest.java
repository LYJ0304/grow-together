package com.growtogether.chat;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.growtogether.common.config.SecurityConfig;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ChatController.class)
@Import(SecurityConfig.class)
class ChatControllerTest {
    private static final String PATH = "/api/v1/chat/generate";

    @Autowired MockMvc mvc;
    @MockitoBean ChatWorkerClient worker;
    @MockitoBean JwtDecoder decoder;

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"Play?\"}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(worker);
    }

    @Test
    void rejectsInvalidInputBeforeCallingWorker() throws Exception {
        String tooManyTurns = ("{\"role\":\"user\",\"content\":\"hi\"},").repeat(20)
                + "{\"role\":\"user\",\"content\":\"hi\"}";
        for (String body : List.of("{}", "{\"message\":\"  \"}",
                "{\"message\":\"" + "x".repeat(4001) + "\"}",
                "{\"message\":\"Hi\",\"history\":[null]}",
                "{\"message\":\"Hi\",\"history\":[{\"role\":\"system\",\"content\":\"Hello\"}]}",
                "{\"message\":\"Hi\",\"history\":[{\"role\":\"user\",\"content\":\" \"}]}",
                "{\"message\":\"Hi\",\"history\":[" + tooManyTurns + "]}")) {
            mvc.perform(post(PATH).with(jwt()).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        verifyNoInteractions(worker);
    }

    @Test
    void returnsReplyForAuthenticatedCallerWithHistory() throws Exception {
        var history = List.of(new ChatController.Turn("assistant", "Try a picture book."));
        when(worker.generate(new ChatController.Question("What next?", history)))
                .thenReturn(new ChatController.Reply("Read it together."));
        mvc.perform(post(PATH).with(jwt()).contentType(MediaType.APPLICATION_JSON).content("""
                {"message":"What next?","history":[{"role":"assistant","content":"Try a picture book."}]}
                """))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.content").value("Read it together."));
    }
}
