package com.growtogether.diary;

import static org.mockito.BDDMockito.then;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.growtogether.common.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(DiaryController.class)
@Import(SecurityConfig.class)
class DiaryDateControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean DiaryService service;
    @MockitoBean JwtDecoder decoder;

    @Test void calendarRouteExistsAndRequiresMonth() throws Exception {
        mvc.perform(get("/api/v1/diary").with(jwt().jwt(t -> t.subject("1"))))
                .andExpect(status().isBadRequest());
    }

    @Test void missingCreationDateIsRejectedBeforeService() throws Exception {
        mvc.perform(post("/api/v1/diary").with(jwt().jwt(t -> t.subject("1")))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Today\",\"todoIds\":[],\"diaryFiles\":[]}"))
                .andExpect(status().isBadRequest());
        then(service).shouldHaveNoInteractions();
    }

    @Test void dateLookupRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/v1/diary/by-date?date=2026-11-10"))
                .andExpect(status().isUnauthorized());
    }
}
