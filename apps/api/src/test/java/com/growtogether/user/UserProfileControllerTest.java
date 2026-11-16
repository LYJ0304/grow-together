package com.growtogether.user;

import static org.mockito.BDDMockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.growtogether.common.config.SecurityConfig;
import com.growtogether.user.dto.UpdateUserProfileRequest;
import com.growtogether.user.dto.UserProfileResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(UserProfileController.class)
@Import(SecurityConfig.class)
class UserProfileControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean UserProfileService profiles;
    @MockitoBean JwtDecoder jwtDecoder;

    @Test void requiresAuthenticationForReadAndWrite() throws Exception {
        mvc.perform(get("/api/v1/users/me")).andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/v1/users/me").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"이름\"}")).andExpect(status().isUnauthorized());
        then(profiles).shouldHaveNoInteractions();
    }

    @Test void readsOnlyPrincipalAndNeverExposesSecurityFields() throws Exception {
        given(profiles.getProfile(7L)).willReturn(new UserProfileResponse(7L, "이름", "owner@example.com"));
        mvc.perform(get("/api/v1/users/me?id=99").with(jwt().jwt(token -> token.subject("7"))))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().json("{\"id\":7,\"name\":\"이름\",\"email\":\"owner@example.com\"}"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
        then(profiles).should().getProfile(7L);
    }

    @Test void validatesRequestBeforeCallingService() throws Exception {
        for (String body : new String[]{"{}", "{\"name\":null}", "{\"name\":\"   \"}", "{\"name\":\"\u00a0\u00a0\"}",
                "{\"name\":\"" + "가".repeat(51) + "\"}", "{"}) {
            mvc.perform(patch("/api/v1/users/me").with(jwt().jwt(token -> token.subject("7")))
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        then(profiles).shouldHaveNoInteractions();
    }

    @Test void updatesOnlyNameUsingThePrincipal() throws Exception {
        var request = new UpdateUserProfileRequest("  새 이름  ");
        given(profiles.updateProfile(7L, request)).willReturn(new UserProfileResponse(7L, "새 이름", "original@example.com"));
        mvc.perform(patch("/api/v1/users/me").with(jwt().jwt(token -> token.subject("7")))
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"  새 이름  \",\"id\":99,\"email\":\"other@example.com\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(7))
                .andExpect(jsonPath("$.email").value("original@example.com"))
                .andExpect(header().string("Cache-Control", "no-store"));
        then(profiles).should().updateProfile(7L, request);
    }
}
