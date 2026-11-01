package com.growtogether.storage;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
class DisabledStorageIntegrationTest {
    @Autowired MockMvc mvc;
    @Test void disabledStorageReturns503WithoutBreakingOtherApis() throws Exception {
        mvc.perform(post("/api/v1/files/presigned-url").with(jwt().jwt(j -> j.subject("1")))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"originalName\":\"a.jpg\",\"contentType\":\"image/jpeg\",\"size\":10}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"));
        mvc.perform(get("/api/health")).andExpect(status().isOk());
    }
}
