package com.growtogether.common.exception;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

class DisconnectedClientTest {
    @RestController
    static class DisconnectedStream {
        @GetMapping("/disconnected")
        void disconnected() throws AsyncRequestNotUsableException {
            throw new AsyncRequestNotUsableException("Client closed the stream");
        }
    }

    @Test void doesNotWriteAnErrorResponseToAnAlreadyDisconnectedClient() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new DisconnectedStream())
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        mvc.perform(get("/disconnected")).andExpect(status().isOk()).andExpect(content().string(""));
    }
}
