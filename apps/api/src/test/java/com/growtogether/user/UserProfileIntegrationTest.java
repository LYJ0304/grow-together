package com.growtogether.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.growtogether.auth.AuthRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class UserProfileIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired AuthRepository users;
    @Autowired org.springframework.security.crypto.password.PasswordEncoder passwords;

    @Test
    void changesOnlyAuthenticatedUsersNameAndPersistsAcrossRequests() throws Exception {
        User owner = users.saveAndFlush(new User("보호자", "profile-owner@example.com", passwords.encode("profile-password-123")));
        String originalHash = owner.getPasswordHash();
        User other = users.saveAndFlush(new User("다른 보호자", "profile-other@example.com", "other-hash"));
        mvc.perform(get("/api/v1/users/me").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("보호자"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
        mvc.perform(patch("/api/v1/users/me").with(jwt().jwt(token -> token.subject(owner.getId().toString())))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"  새 이름  \"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("새 이름"));
        mvc.perform(get("/api/v1/users/me").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("새 이름"))
                .andExpect(jsonPath("$.email").value("profile-owner@example.com"));
        String login = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"profile-owner@example.com\",\"password\":\"profile-password-123\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String token = com.jayway.jsonpath.JsonPath.read(login, "$.accessToken");
        mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("새 이름"));
        User updated = users.findById(owner.getId()).orElseThrow();
        assertThat(updated.getPasswordHash()).isEqualTo(originalHash);
        assertThat(users.findById(other.getId()).orElseThrow().getName()).isEqualTo("다른 보호자");
    }
}
