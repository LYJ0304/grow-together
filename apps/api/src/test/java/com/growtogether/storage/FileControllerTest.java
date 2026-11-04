package com.growtogether.storage;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.growtogether.common.config.SecurityConfig;
import com.growtogether.storage.dto.FileResponse;
import com.growtogether.storage.dto.PresignedUrlResponse;
import java.time.Instant;
import java.util.UUID;
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
    private static final UUID FILE_ID = UUID.randomUUID();
    private static final String REQUEST = """
            {"filename":"photo.png","contentType":"image/png","fileSize":1234}
            """;
    @Autowired private MockMvc mvc;
    @MockitoBean private FileService files;
    @MockitoBean private JwtDecoder jwtDecoder;

    @Test
    void issueUploadUrl_usesAuthenticatedOwnerAndReturns201() throws Exception {
        given(files.issueUploadUrl(eq(7L), any())).willReturn(new PresignedUrlResponse(
                FILE_ID, "https://storage.example.com/upload", "files/7/random", Instant.parse("2026-11-04T12:10:00Z")));
        mvc.perform(post("/api/files/presigned-url").with(jwt().jwt(token -> token.subject("7")))
                        .contentType(MediaType.APPLICATION_JSON).content(REQUEST))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fileId").value(FILE_ID.toString()))
                .andExpect(jsonPath("$.uploadUrl").value("https://storage.example.com/upload"))
                .andExpect(jsonPath("$.expiresAt").value("2026-11-04T12:10:00Z"));
    }

    @Test
    void completeUpload_usesAuthenticatedOwnerAndReturns200() throws Exception {
        given(files.completeUpload(7L, FILE_ID)).willReturn(new FileResponse(FILE_ID, "photo.png",
                "image/png", 1234L, FileStatus.COMPLETED, Instant.parse("2026-11-04T12:00:00Z")));
        mvc.perform(post("/api/files/{id}/complete", FILE_ID).with(jwt().jwt(token -> token.subject("7"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.fileSize").value(1234));
        then(files).should().completeUpload(7L, FILE_ID);
    }

    @Test
    void invalidRequests_return400WithoutCallingService() throws Exception {
        for (String body : new String[] {"{}", "{", REQUEST.replace("photo.png", " "),
                REQUEST.replace("image/png", " "), REQUEST.replace("1234", "0"), REQUEST.replace("1234", "-1")}) {
            mvc.perform(post("/api/files/presigned-url").with(jwt())
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        mvc.perform(post("/api/files/not-a-uuid/complete").with(jwt()))
                .andExpect(status().isBadRequest());
        then(files).shouldHaveNoInteractions();
    }

    @Test
    void bothOperations_requireAuthentication() throws Exception {
        mvc.perform(post("/api/files/presigned-url").contentType(MediaType.APPLICATION_JSON).content(REQUEST))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/files/{id}/complete", FILE_ID)).andExpect(status().isUnauthorized());
        then(files).shouldHaveNoInteractions();
    }
}
