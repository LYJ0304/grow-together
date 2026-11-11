package com.growtogether.todo;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import com.growtogether.common.config.SecurityConfig;
import com.growtogether.todo.schedule.*;
import static org.mockito.Mockito.*;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ScheduleController.class)
@Import(SecurityConfig.class)
class ScheduleControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean ScheduleGenerationService generation;
    @MockitoBean ScheduleBatchService batch;
    @MockitoBean JwtDecoder decoder;

    @Test void requiresAuthentication() throws Exception {
        mvc.perform(post("/api/v1/todos/generate").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(generation,batch);
    }
    @Test void rejectsInvalidWindowsAndCandidates() throws Exception {
        for (String content : new String[]{
            "{\"date\":\"2026-11-10\",\"availableWindows\":[]}",
            "{\"date\":\"2026-11-10\",\"availableWindows\":[{\"start\":\"10:00\",\"end\":\"09:00\"}]}",
            "{\"date\":\"invalid\",\"availableWindows\":[{\"start\":\"09:00\",\"end\":\"10:00\"}]}"
        }) mvc.perform(post("/api/v1/todos/generate").with(jwt().jwt(j->j.subject("1")))
                .contentType(MediaType.APPLICATION_JSON).content(content)).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/todos/batch").with(jwt().jwt(j->j.subject("1")))
                .contentType(MediaType.APPLICATION_JSON).content("{\"date\":\"2026-11-10\",\"candidates\":[{\"planName\":\"read\",\"scheduledTime\":\"09:00\",\"durationMinutes\":0}]}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(generation,batch);
    }
    @Test void rejectsEmptyGenerationAndBatchWithoutCallingWorker() throws Exception {
        for (String operation : new String[]{"generate", "batch"}) {
            mvc.perform(post("/api/v1/todos/" + operation)
                    .with(jwt().jwt(j -> j.subject("1")))
                    .contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isBadRequest());
        }
    }
}
