package com.growtogether.todo;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import com.growtogether.common.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(TodoController.class)
@Import(SecurityConfig.class)
class TodoReactionControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean TodoService service;
    @MockitoBean JwtDecoder decoder;
    @Test void validatesInputAndPassesAuthenticatedOwner() throws Exception {
        var todo = new Todo(7L,"Walk",null,java.time.LocalDate.of(2026,11,13),java.time.LocalTime.of(9,0));
        todo.setCompleted(true);
        todo.setChildReaction(ChildReaction.NEUTRAL);
        when(service.setReaction(7L,1L,ChildReaction.NEUTRAL)).thenReturn(com.growtogether.todo.dto.TodoResponse.from(todo));
        mvc.perform(put("/api/v1/todos/1/reaction").with(jwt().jwt(j -> j.subject("7")))
                .contentType(MediaType.APPLICATION_JSON).content("{\"childReaction\":\"NEUTRAL\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.childReaction").value("NEUTRAL"));
        verify(service).setReaction(7L,1L,ChildReaction.NEUTRAL);
        mvc.perform(put("/api/v1/todos/1/reaction").with(jwt().jwt(j -> j.subject("7")))
                .contentType(MediaType.APPLICATION_JSON).content("{\"childReaction\":null}"))
                .andExpect(status().isOk());
        verify(service).setReaction(7L,1L,null);
        clearInvocations(service);
        for (String body : new String[]{"{}","null","[]","{\"childReaction\":1}","{\"childReaction\":true}","{\"childReaction\":\"unknown\"}"}) {
            mvc.perform(put("/api/v1/todos/1/reaction").with(jwt().jwt(j -> j.subject("7")))
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
    }
    @Test void acceptsReactionAndRequiresAuthentication() throws Exception {
        mvc.perform(put("/api/v1/todos/1/reaction").with(jwt().jwt(j -> j.subject("7")))
                .contentType(MediaType.APPLICATION_JSON).content("{\"childReaction\":\"ENJOYED\"}"))
                .andExpect(status().isOk());
        mvc.perform(put("/api/v1/todos/1/reaction").contentType(MediaType.APPLICATION_JSON)
                .content("{\"childReaction\":null}")).andExpect(status().isUnauthorized());
    }
}
