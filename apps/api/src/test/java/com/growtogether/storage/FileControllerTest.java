package com.growtogether.storage;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.growtogether.common.config.SecurityConfig;
import com.growtogether.storage.dto.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
@WebMvcTest(FileController.class)
@Import(SecurityConfig.class)
class FileControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean FileService service;
    @MockitoBean JwtDecoder decoder;
    UUID id = UUID.randomUUID();
    @Test void allRoutesRequireAuthentication() throws Exception {
        mvc.perform(post("/api/v1/files/presigned-url").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/files/" + id)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/files/" + id + "/download-url")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/files/" + id + "/complete")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/files/" + id)).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }
    @Test void validatesInputAndUsesAuthenticatedOwnerForUpload() throws Exception {
        var request = new UploadUrlRequest("a.jpg", "image/jpeg", 10L);
        when(service.initiateUpload(7L, request)).thenReturn(new UploadUrlResponse(id,
                "https://storage/upload", Instant.now().plusSeconds(300), Map.of("If-None-Match", "*")));
        mvc.perform(post("/api/v1/files/presigned-url").with(jwt().jwt(j -> j.subject("7")))
                .contentType(MediaType.APPLICATION_JSON).content("""
                {"originalName":"a.jpg","contentType":"image/jpeg","size":10,"userId":8}
                """))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(id.toString()))
                .andExpect(jsonPath("$.headers.If-None-Match").value("*"));
        mvc.perform(post("/api/v1/files/presigned-url").with(jwt()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"originalName\":\"\",\"contentType\":\"image/jpeg\",\"size\":0}"))
                .andExpect(status().isBadRequest());
        verify(service).initiateUpload(7L, request);
        verifyNoMoreInteractions(service);
    }
    @Test void completionAndDeleteDelegateOwnerAndUuid() throws Exception {
        mvc.perform(post("/api/v1/files/" + id + "/complete").with(jwt().jwt(j -> j.subject("7"))))
                .andExpect(status().isOk()).andExpect(content().string(""));
        mvc.perform(delete("/api/v1/files/" + id).with(jwt().jwt(j -> j.subject("7"))))
                .andExpect(status().isNoContent());
        verify(service).completeUpload(7L, id);
        verify(service).deleteFile(7L, id);
    }
    @Test void malformedUuidIsBadRequest() throws Exception {
        mvc.perform(get("/api/v1/files/not-a-uuid").with(jwt())).andExpect(status().isBadRequest());
    }
}
