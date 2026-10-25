package com.growtogether.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class SwaggerUiIntegrationTest {
    @Autowired private MockMvc mvc;

    @Test
    void anonymouslyLoadsSwaggerUiAndItsAssets() throws Exception {
        mvc.perform(get("/swagger-ui.html")).andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/swagger-ui/index.html"));
        mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Swagger UI")));
        for (String asset : new String[] {"swagger-ui.css", "swagger-ui-bundle.js", "swagger-initializer.js"}) {
            mvc.perform(get("/swagger-ui/" + asset)).andExpect(status().isOk());
        }
        mvc.perform(get("/v3/api-docs/swagger-config")).andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("/openapi.yaml"));
    }

    @Test
    void servesTheCanonicalContractWithoutGeneratingAnotherDefinition() throws Exception {
        String contract = Files.readString(Path.of("../../contracts/openapi.yaml"), StandardCharsets.UTF_8);
        mvc.perform(get("/openapi.yaml")).andExpect(status().isOk())
                .andExpect(content().string(contract));
        mvc.perform(get("/v3/api-docs")).andExpect(status().isUnauthorized());
    }

    @Test
    @Transactional
    void loginTokenAuthorizesApiCallsWhileAnonymousRequestsRemainBlocked() throws Exception {
        String credentials = """
                {"email":"swagger@example.com","password":"swagger-test-password"}
                """;
        mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name":"Swagger tester","email":"swagger@example.com","password":"swagger-test-password"}
                        """))
                .andExpect(status().isCreated());
        String login = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(credentials)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String token = JsonPath.read(login, "$.accessToken");
        assertThat(token).isNotBlank();
        mvc.perform(get("/api/v1/todos").param("date", "2026-10-17"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/diary/1")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/todos").param("date", "2026-10-17")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
    }
}
