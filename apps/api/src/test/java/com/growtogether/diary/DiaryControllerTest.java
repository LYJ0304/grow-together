package com.growtogether.diary;

import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import tools.jackson.databind.ObjectMapper;

import com.growtogether.common.config.SecurityConfig;
import com.growtogether.diary.domain.dto.DiaryRequest;
import com.growtogether.diary.domain.dto.DiaryResponse;

@WebMvcTest(DiaryController.class)
@Import(SecurityConfig.class)
public class DiaryControllerTest {
    Long userId = 1L;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private DiaryService diaryService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void create_정상요청이면_201CREATED_반환() throws Exception {
        var request = new DiaryRequest("안녕하세요.", List.of(), List.of());
        var response = new DiaryResponse(1L, "안녕하세요", List.of(), List.of());

        given(diaryService.create(userId, request)).willReturn(response);

        mockMvc.perform(post("/api/v1/diary")
                .with(jwt().jwt(token -> token.subject(userId.toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(response.id()))
            .andExpect(jsonPath("$.content").value(response.content()))
            .andExpect(jsonPath("$.todos").isEmpty())
            .andExpect(jsonPath("$.diaryFiles").isEmpty());

        then(diaryService).should().create(userId, request);
    }

    @Test
    void get_정상요청이면_200OK_반환() throws Exception {
        Long id = 10L;
        var response = new DiaryResponse(id, "안녕하세요.", List.of(), List.of());

        given(diaryService.getDiary(userId, id)).willReturn(response);

        mockMvc.perform(get("/api/v1/diary/{id}", id)
                .with(jwt().jwt(token -> token.subject(userId.toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(response.id()))
            .andExpect(jsonPath("$.content").value(response.content()))
            .andExpect(jsonPath("$.todos").isEmpty())
            .andExpect(jsonPath("$.diaryFiles").isEmpty());

        then(diaryService).should().getDiary(userId, id);
    }

    @Test
    void update_정상요청이면_200OK_반환() throws Exception {
        Long id = 10L;
        var request = new DiaryRequest("수정한 일기입니다.", List.of(), List.of());
        var response = new DiaryResponse(id, request.content(), List.of(), List.of());

        given(diaryService.updateDiary(userId, id, request)).willReturn(response);

        mockMvc.perform(put("/api/v1/diary/{id}", id)
                .with(jwt().jwt(token -> token.subject(userId.toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(response.id()))
            .andExpect(jsonPath("$.content").value(response.content()))
            .andExpect(jsonPath("$.todos").isEmpty())
            .andExpect(jsonPath("$.diaryFiles").isEmpty());

        then(diaryService).should().updateDiary(userId, id, request);
    }

    @Test
    void delete_정상요청이면_204NOCONTENT_반환() throws Exception {
        Long id = 10L;

        mockMvc.perform(delete("/api/v1/diary/{id}", id)
                .with(jwt().jwt(token -> token.subject(userId.toString()))))
            .andExpect(status().isNoContent())
            .andExpect(content().string(""));

        then(diaryService).should().deleteDiary(userId, id);
    }
}
